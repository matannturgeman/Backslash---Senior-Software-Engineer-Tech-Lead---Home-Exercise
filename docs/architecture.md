# Architecture

## Module Breakdown (NestJS)

```
apps/api/src/app/
├── app.module.ts               ← Root module — imports all feature modules
│
├── graph/
│   ├── graph.module.ts         ← Feature module (imports Neo4j, Cache, Config)
│   ├── graph.controller.ts     ← REST: GET /graph, /graph/filters, /graph/routes
│   ├── graph.service.ts        ← Cypher query builder + result deduplication
│   ├── graph.loader.ts         ← JSON parse, Zod validation, edge normalization
│   ├── graph.importer.ts       ← Neo4j seeding on startup (hash-optimized, retry)
│   ├── graph.cache-keys.ts     ← Cache key constants
│   └── graph.dto.ts            ← Swagger response DTOs
│
├── filters/
│   └── filter.registry.ts      ← Named Cypher WHERE fragments
│
├── cache/
│   └── cache.service.ts        ← Redis cache-aside (graceful degradation)
│
├── neo4j/
│   ├── neo4j.module.ts         ← Global provider of Neo4j Driver
│   ├── neo4j.service.ts        ← Session-level query runner
│   └── neo4j.constants.ts      ← DI token: NEO4J_DRIVER
│
└── health/
    ├── health.module.ts
    └── health.controller.ts    ← GET /health (Neo4j + Redis liveness)

libs/shared/types/src/lib/types.ts
    GraphNode, GraphEdge, Graph, CypherFilter, Vulnerability
```

---

## High-Level Data Flow

```
train-ticket.json (bundled asset)
       │
       ▼
 GraphLoader (onModuleInit)
   - Read file, parse JSON
   - Validate with Zod rawGraphSchema
   - Normalize edges: to: string | string[] → flat GraphEdge[]
   - Compute SHA-256 hash of file contents
       │
       ▼
 GraphImporter (onModuleInit, retries up to 4×)
   - Query Neo4j for GraphMeta.hash
   - If hash unchanged → skip seed (no-op)
   - If changed / first run:
       └─ WRITE TRANSACTION:
           1. Delete all existing nodes + relationships
           2. CREATE nodes from loader data
           3. MATCH + CREATE [:CALLS] relationships
           4. Store new hash in GraphMeta
       └─ Invalidate Redis cache (pattern delete)
       │
       ▼
 Neo4j graph is ready for queries
```

---

## Request Flow: `GET /graph/routes?filters=publicStart,sinkEnd`

```
HTTP Request
    │
    ▼
GraphController.getRoutes(filtersParam)
    │  Parse & trim comma-separated names
    ▼
GraphService.getFilteredGraph(filterNames)
    │
    ├─ Validate filter names → unknown names → 400
    │
    ├─ Build cache key: graph:filtered:hasVulnerability,publicStart,sinkEnd (sorted)
    │
    ├─ CacheService.get(key) ──► Redis HIT → return cached graph
    │                                 │
    │                           Redis MISS ↓
    │
    ├─ Build Cypher WHERE conditions from filter registry:
    │    startWhere  │ "start.publicExposed = true"
    │    endWhere    │ "end.kind IN ['rds', 'sql']"
    │    pathWhere   │ (any vulnerability filters)
    │    + NODE_UNIQUENESS clause (no repeated nodes per path)
    │
    ├─ Neo4jService.run(cypher, params)
    │    MATCH p = (start:Node)-[:CALLS*1..MAX_PATH_DEPTH]->(end:Node)
    │    WHERE <conditions>
    │    RETURN p LIMIT MAX_RESULT_PATHS
    │
    ├─ Deduplicate nodes + edges from all returned path segments
    │
    ├─ Guard: nodeCount > MAX_RESPONSE_NODES → 400 "add more filters"
    │
    ├─ CacheService.set(key, graph, TTL)
    │
    └─ Return { nodes[], edges[] }
```

---

## Filter System

Filters are Cypher WHERE fragments, not JS predicates. This means filtering happens inside the database — no paths are loaded into memory only to be discarded.

```ts
// libs/shared/types
interface CypherFilter {
  startWhere?: string;   // condition on the path's start node
  endWhere?: string;     // condition on the path's end node
  pathWhere?: string;    // condition on the path or any node in it
}

// apps/api/src/app/filters/filter.registry.ts
export const filterRegistry: Record<string, CypherFilter> = {
  publicStart:      { startWhere: 'start.publicExposed = true' },
  sinkEnd:          { endWhere:   'end.kind IN ["rds", "sql"]' },
  hasVulnerability: { pathWhere:  'any(n IN nodes(p) WHERE n.hasVulnerability = true)' },
};
```

Filters compose by **AND** — all `startWhere`, `endWhere`, and `pathWhere` clauses from every selected filter are joined with `AND` into a single Cypher `WHERE`.

---

## Caching Layer

**Pattern:** Cache-aside (read-through / write-on-miss)

```
Request
  │
  ├─ CacheService.get(key)
  │    Redis available? → GET key → HIT → return
  │                               → MISS ↓
  │
  ├─ Query Neo4j
  │
  └─ CacheService.set(key, value, ttl)
       Redis available? → SET key EX ttl
       Redis unavailable? → log warning, continue (no error thrown)
```

**Graceful Degradation:** If Redis is down, `available = false` and all cache operations are silently skipped. The API continues functioning with direct Neo4j queries.

**Invalidation:** On graph re-seed, all `graph:*` keys are deleted via `SCAN` pattern match.

---

## Neo4j Schema

```
Nodes:  (:Node { name, kind, publicExposed, hasVulnerability, language, path, ... })
Rels:   (:Node)-[:CALLS]->(:Node)
Meta:   (:GraphMeta { hash })  ← seed optimization
Index:  CREATE CONSTRAINT ON (n:Node) ASSERT n.name IS UNIQUE
```

**Node Uniqueness in Paths:** Cypher `[:CALLS*]` uses relationship-uniqueness by default (no repeated edges), but nodes can repeat. The query adds:
```cypher
ALL(n IN nodes(p) WHERE single(x IN nodes(p) WHERE x = n))
```
This enforces simple paths (no repeated nodes), matching DFS visited-set semantics.

---

## Configuration

All runtime config is resolved via NestJS `ConfigService` from environment variables. See [infrastructure.md](./infrastructure.md) for full variable list.

---

## Testing Strategy

| Layer | Tool | Count |
|---|---|---|
| Unit | Jest (ts-jest) | 16 tests |
| E2E | Jest + Testcontainers (real Neo4j + Redis) | 20 tests |

Unit tests cover: `GraphLoader`, `GraphService` (Cypher composition), `FilterRegistry`.
E2E tests cover: all 4 endpoints, error cases, filter correctness against real data.
