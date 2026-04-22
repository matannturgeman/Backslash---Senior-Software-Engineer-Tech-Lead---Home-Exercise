import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CacheService } from '@libs/server-cache';
import { Neo4jService } from '@libs/server-neo4j';
import { CACHE_KEY_PATTERN_ALL } from './graph.cache-keys';
import { GraphLoader } from './graph.loader';

@Injectable()
export class GraphImporter implements OnModuleInit {
  private readonly logger = new Logger(GraphImporter.name);

  constructor(
    private readonly loader: GraphLoader,
    private readonly neo4j: Neo4jService,
    private readonly cache: CacheService,
  ) {}

  async onModuleInit() {
    await this.withRetry(() => this.initializeGraph());
  }

  private async initializeGraph() {
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
    await this.invalidateCache();
    this.logger.log(
      `Seeded ${this.loader.nodes.size} nodes, ${this.loader.edges.length} edges`,
    );
  }

  private async withRetry(
    fn: () => Promise<void>,
    attempts = 4,
    delayMs = 2000,
  ): Promise<void> {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        // Only retry transient connectivity errors — fail fast on logic/query bugs
        if (!GraphImporter.isTransientError(err) || attempt === attempts) {
          this.logger.error(
            `Neo4j unavailable after ${attempts} attempts — shutting down`,
          );
          throw err;
        }
        this.logger.warn(
          `Neo4j unavailable (attempt ${attempt}/${attempts}), retrying in ${delayMs}ms…`,
        );
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  private static isTransientError(err: unknown): boolean {
    const code =
      err instanceof Error && 'code' in err
        ? (err as { code: string }).code
        : '';
    // Neo4j ServiceUnavailable / SessionExpired — driver-level transient errors
    if (code === 'ServiceUnavailable' || code === 'SessionExpired') return true;
    // Node.js network errors before Neo4j has started
    return ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(code);
  }

  private async invalidateCache() {
    await this.cache.invalidatePattern(CACHE_KEY_PATTERN_ALL);
    this.logger.log('Graph cache invalidated');
  }

  private async seed() {
    const nodeNames = this.loader.nodes;
    const dangling = this.loader.edges.filter(e => !nodeNames.has(e.to) || !nodeNames.has(e.from));
    if (dangling.length > 0) {
      this.logger.warn(
        `Skipping ${dangling.length} edge(s) that reference unknown nodes: ` +
        dangling.map(e => `"${e.from}" → "${e.to}"`).join(', ')
      );
    }
    const validEdges = this.loader.edges.filter(e => nodeNames.has(e.to) && nodeNames.has(e.from));

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
        { edges: validEdges },
      );

      await tx.run('MERGE (m:GraphMeta) SET m.hash = $hash', {
        hash: this.loader.fileHash,
      });
    });

    // Constraint created outside transaction (DDL in Neo4j can't run inside write tx)
    await this.neo4j.run(
      'CREATE CONSTRAINT node_name_unique IF NOT EXISTS FOR (n:Node) REQUIRE n.name IS UNIQUE',
    );
  }
}
