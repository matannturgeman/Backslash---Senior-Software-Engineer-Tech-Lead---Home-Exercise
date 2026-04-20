import { BadRequestException, Injectable } from '@nestjs/common';
import type { Graph, GraphEdge, GraphNode } from '@libs/shared-types';
import { AVAILABLE_FILTERS, filterRegistry } from '../filters/filter.registry.js';
import { Neo4jService } from '../neo4j/neo4j.service.js';

// Neo4j path matching uses relationship-uniqueness by default (no relationship
// repeated), but nodes can repeat in cyclic graphs. The ALL() clause enforces
// node uniqueness, matching the behaviour of our original DFS visited-set.
const NODE_UNIQUENESS = 'ALL(n IN nodes(p) WHERE single(x IN nodes(p) WHERE x = n))';

// Configurable via env — default covers all practical microservice path depths
const MAX_PATH_DEPTH = Number(process.env.MAX_PATH_DEPTH ?? 20);

@Injectable()
export class GraphService {
  constructor(private readonly neo4j: Neo4jService) {}

  async getFullGraph(): Promise<Graph> {
    const [nodesResult, edgesResult] = await Promise.all([
      this.neo4j.run('MATCH (n:Node) RETURN n'),
      this.neo4j.run(
        'MATCH (a:Node)-[:CALLS]->(b:Node) RETURN a.name AS from, b.name AS to',
      ),
    ]);

    return {
      nodes: nodesResult.records.map((r) => this.mapNode(r.get('n').properties)),
      edges: edgesResult.records.map((r) => ({
        from: r.get('from') as string,
        to: r.get('to') as string,
      })),
    };
  }

  async getFilteredGraph(filterNames: string[]): Promise<Graph> {
    this.validateFilters(filterNames);

    const filters = filterNames.map((n) => filterRegistry[n]);
    const conditions = [
      NODE_UNIQUENESS,
      ...filters.flatMap((f) =>
        [f.startWhere, f.endWhere, f.pathWhere].filter(Boolean),
      ),
    ];

    const result = await this.neo4j.run(
      `MATCH p = (start:Node)-[:CALLS*1..${MAX_PATH_DEPTH}]->(end:Node)
       WHERE ${conditions.join(' AND ')}
       RETURN p`,
    );

    const nodeMap = new Map<string, GraphNode>();
    const edgeSet = new Set<string>();
    const edges: GraphEdge[] = [];

    for (const record of result.records) {
      const path = record.get('p');
      for (const segment of path.segments) {
        const from = this.mapNode(segment.start.properties);
        const to = this.mapNode(segment.end.properties);
        nodeMap.set(from.name, from);
        nodeMap.set(to.name, to);
        const key = `${from.name}→${to.name}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push({ from: from.name, to: to.name });
        }
      }
    }

    return { nodes: [...nodeMap.values()], edges };
  }

  private validateFilters(names: string[]) {
    const unknown = names.filter((n) => !(n in filterRegistry));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown filter(s): ${unknown.join(', ')}. Available: ${AVAILABLE_FILTERS.join(', ')}`,
      );
    }
  }

  private mapNode(props: Record<string, unknown>): GraphNode {
    return {
      name:            props['name'] as string,
      kind:            props['kind'] as GraphNode['kind'],
      publicExposed:   props['publicExposed'] as boolean | undefined,
      vulnerabilities: props['vulnerabilities']
        ? JSON.parse(props['vulnerabilities'] as string)
        : undefined,
      language:        props['language'] as string | undefined,
      path:            props['path'] as string | undefined,
      metadata:        props['metadata']
        ? JSON.parse(props['metadata'] as string)
        : undefined,
    };
  }
}
