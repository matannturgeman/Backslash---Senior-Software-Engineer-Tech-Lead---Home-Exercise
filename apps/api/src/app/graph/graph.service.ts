import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Graph, GraphEdge, GraphNode } from '@libs/shared-types';
import { CacheService } from '../cache/cache.service.js';
import { AVAILABLE_FILTERS, filterRegistry } from '../filters/filter.registry.js';
import { CACHE_KEY_FULL_GRAPH, CACHE_KEY_FILTERED_PREFIX } from './graph.cache-keys.js';
import { graphNodeSchema } from './graph.loader.js';
import { Neo4jService } from '../neo4j/neo4j.service.js';

// Neo4j path matching uses relationship-uniqueness by default (no relationship
// repeated), but nodes can repeat in cyclic graphs. The ALL() clause enforces
// node uniqueness, matching the behaviour of our original DFS visited-set.
const NODE_UNIQUENESS = 'ALL(n IN nodes(p) WHERE single(x IN nodes(p) WHERE x = n))';

@Injectable()
export class GraphService {
  constructor(
    private readonly neo4j: Neo4jService,
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {}

  async getFullGraph(): Promise<Graph> {
    const cached = await this.cache.get<Graph>(CACHE_KEY_FULL_GRAPH);
    if (cached) return cached;

    const [nodesResult, edgesResult] = await Promise.all([
      this.neo4j.run('MATCH (n:Node) RETURN n'),
      this.neo4j.run(
        'MATCH (a:Node)-[:CALLS]->(b:Node) RETURN a.name AS from, b.name AS to',
      ),
    ]);

    const graph: Graph = {
      nodes: nodesResult.records.map((r) => this.mapNode(r.get('n').properties)),
      edges: edgesResult.records.map((r) => ({
        from: r.get('from') as string,
        to: r.get('to') as string,
      })),
    };

    await this.cache.set(CACHE_KEY_FULL_GRAPH, graph);
    return graph;
  }

  async getFilteredGraph(filterNames: string[]): Promise<Graph> {
    this.validateFilters(filterNames);

    const cacheKey = `${CACHE_KEY_FILTERED_PREFIX}:${[...filterNames].sort().join(',')}`;
    const cached = await this.cache.get<Graph>(cacheKey);
    if (cached) return cached;

    const filters = filterNames.map((n) => filterRegistry[n]);
    const conditions = [
      NODE_UNIQUENESS,
      ...filters.flatMap((f) =>
        [f.startWhere, f.endWhere, f.pathWhere].filter(Boolean),
      ),
    ];

    const maxDepth = this.positiveInt('MAX_PATH_DEPTH', 20);
    const maxPaths = this.positiveInt('MAX_RESULT_PATHS', 10_000);
    const maxNodes = this.positiveInt('MAX_RESPONSE_NODES', 5_000);
    const result = await this.neo4j.run(
      `MATCH p = (start:Node)-[:CALLS*1..${maxDepth}]->(end:Node)
       WHERE ${conditions.join(' AND ')}
       RETURN p LIMIT ${maxPaths}`,
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
        if (nodeMap.size > maxNodes) {
          throw new BadRequestException(
            `Result exceeds ${maxNodes} nodes — add more filters to narrow the query.`,
          );
        }
        const key = `${from.name}→${to.name}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push({ from: from.name, to: to.name });
        }
      }
    }

    const graph: Graph = { nodes: [...nodeMap.values()], edges };
    await this.cache.set(cacheKey, graph);
    return graph;
  }

  private validateFilters(names: string[]) {
    const unknown = names.filter((n) => !(n in filterRegistry));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown filter(s): ${unknown.join(', ')}. Available: ${AVAILABLE_FILTERS.join(', ')}`,
      );
    }
  }

  // Falls back to defaultValue when the env var is missing, non-numeric, or ≤ 0.
  private positiveInt(key: string, defaultValue: number): number {
    const v = this.config.get<number>(key, defaultValue);
    return Number.isInteger(v) && v > 0 ? v : defaultValue;
  }

  private mapNode(props: Record<string, unknown>): GraphNode {
    return graphNodeSchema.parse({
      ...props,
      vulnerabilities: props['vulnerabilities']
        ? JSON.parse(props['vulnerabilities'] as string)
        : undefined,
      metadata: props['metadata']
        ? JSON.parse(props['metadata'] as string)
        : undefined,
    });
  }
}
