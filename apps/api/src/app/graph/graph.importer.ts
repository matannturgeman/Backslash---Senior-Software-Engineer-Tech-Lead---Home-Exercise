import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Neo4jService } from '../neo4j/neo4j.service.js';
import { GraphLoader } from './graph.loader.js';

@Injectable()
export class GraphImporter implements OnModuleInit {
  private readonly logger = new Logger(GraphImporter.name);

  constructor(
    private readonly loader: GraphLoader,
    private readonly neo4j: Neo4jService,
  ) {}

  async onModuleInit() {
    const hash = this.loader.fileHash;

    const stored = await this.neo4j.run(
      'MATCH (m:GraphMeta) RETURN m.hash AS hash',
    );

    if (stored.records[0]?.get('hash') === hash) {
      this.logger.log('Graph unchanged — skipping seed');
      return;
    }

    this.logger.log('Seeding Neo4j...');
    await this.seed();
    this.logger.log(
      `Seeded ${this.loader.nodes.size} nodes, ${this.loader.edges.length} edges`,
    );
  }

  private async seed() {
    // Warn about edges referencing nodes that don't exist in the JSON
    const nodeNames = this.loader.nodes;
    for (const edge of this.loader.edges) {
      if (!nodeNames.has(edge.to)) {
        this.logger.warn(`Edge target "${edge.to}" not found in nodes — skipping`);
      }
    }

    await this.neo4j.writeTransaction(async (tx) => {
      await tx.run('MATCH (n:Node) DETACH DELETE n');
      await tx.run('MATCH (m:GraphMeta) DELETE m');

      await tx.run(
        `UNWIND $nodes AS n
         CREATE (:Node {
           name:             n.name,
           kind:             n.kind,
           publicExposed:    coalesce(n.publicExposed, false),
           hasVulnerability: n.hasVulnerability,
           vulnerabilities:  n.vulnerabilities,
           language:         n.language,
           path:             n.path,
           metadata:         n.metadata
         })`,
        {
          nodes: [...this.loader.nodes.values()].map((n) => ({
            name:             n.name,
            kind:             n.kind,
            publicExposed:    n.publicExposed ?? false,
            hasVulnerability: (n.vulnerabilities?.length ?? 0) > 0,
            vulnerabilities:  JSON.stringify(n.vulnerabilities ?? []),
            language:         n.language ?? null,
            path:             n.path ?? null,
            metadata:         n.metadata ? JSON.stringify(n.metadata) : null,
          })),
        },
      );

      await tx.run(
        `UNWIND $edges AS e
         MATCH (a:Node {name: e.from}), (b:Node {name: e.to})
         CREATE (a)-[:CALLS]->(b)`,
        { edges: this.loader.edges },
      );

      await tx.run('MERGE (m:GraphMeta) SET m.hash = $hash', {
        hash: this.loader.fileHash,
      });
    });

    // Index created outside transaction (DDL in Neo4j can't run inside write tx)
    await this.neo4j.run(
      'CREATE INDEX node_name IF NOT EXISTS FOR (n:Node) ON (n.name)',
    );
  }
}
