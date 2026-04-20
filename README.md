# Backslash — Graph Query Engine

A RESTful API that loads a microservices graph from a JSON file, persists it in Neo4j, and exposes a composable query engine on top of it.

Built as part of the Backslash Senior Software Engineer / Tech Lead home exercise.

---

## Quick Start

```bash
# 1. Start Neo4j
docker-compose up -d

# 2. Install deps
npm install

# 3. Configure env
cp .env.example .env   # defaults work with docker-compose

# 4. Build & run
npx nx build api
node dist/api/main.js
```

API: `http://localhost:3000/api`
Swagger docs: `http://localhost:3000/docs`

---

## API

### `GET /api/graph`
Returns the full graph — all nodes and edges.

```json
{
  "nodes": [
    { "name": "frontend", "kind": "service", "publicExposed": true },
    { "name": "prod-postgresdb", "kind": "rds", "metadata": { "cloud": "AWS" } }
  ],
  "edges": [
    { "from": "frontend", "to": "admin-basic-info-service" }
  ]
}
```

### `GET /api/graph/filters`
Returns the list of available filter names.

```json
{ "filters": ["publicStart", "sinkEnd", "hasVulnerability"] }
```

### `GET /api/graph/routes?filters=<filter1>,<filter2>`
Returns a filtered subgraph — only nodes and edges that appear in paths matching **all** specified filters.

| Filter | Description |
|---|---|
| `publicStart` | Path starts at a `publicExposed: true` node |
| `sinkEnd` | Path ends at an `rds` or `sql` node |
| `hasVulnerability` | Path passes through a node with at least one known vulnerability |

**Examples:**
```
GET /api/graph/routes?filters=publicStart
GET /api/graph/routes?filters=sinkEnd
GET /api/graph/routes?filters=publicStart,sinkEnd,hasVulnerability
```

Unknown filter names return `400 Bad Request`.

---

## Architecture

```
apps/api/src/app/
  graph/
    graph.loader.ts     — reads JSON on startup, normalizes edges, computes SHA-256 hash
    graph.importer.ts   — seeds Neo4j on startup (skips if hash unchanged)
    graph.service.ts    — Cypher path queries + filter composition
    graph.controller.ts — REST endpoints
    graph.module.ts
  filters/
    filter.registry.ts  — central map of name → CypherFilter
  neo4j/
    neo4j.module.ts     — global module, provides neo4j-driver from env
    neo4j.service.ts    — thin wrapper: run() + writeTransaction()

libs/shared/types/      — GraphNode, GraphEdge, Graph, CypherFilter
```

### Data flow

```
JSON file ──► GraphLoader (hash + normalize)
                   │
                   ▼
            GraphImporter.onModuleInit()
             hash match? skip : seed Neo4j atomically
                   │
                   ▼  (per request)
            GraphService.getFilteredGraph(filterNames)
             build Cypher WHERE from CypherFilter fields
             MATCH p = (start)-[:CALLS*1..20]->(end) WHERE ...
                   │
                   ▼
             deduplicate nodes + edges from path segments → return subgraph
```

---

## How filtering works

Each filter is a `CypherFilter` — a plain object with optional WHERE clause fragments:

```ts
interface CypherFilter {
  startWhere?: string;  // condition on path start node
  endWhere?:   string;  // condition on path end node
  pathWhere?:  string;  // condition on the path or any node in it
}
```

All active filter clauses are combined with `AND` into a single Cypher query:

```cypher
MATCH p = (start:Node)-[:CALLS*1..20]->(end:Node)
WHERE ALL(n IN nodes(p) WHERE single(x IN nodes(p) WHERE x = n))  -- node uniqueness
  AND start.publicExposed = true           -- publicStart
  AND end.kind IN ["rds", "sql"]           -- sinkEnd
  AND any(n IN nodes(p) WHERE n.hasVulnerability = true)  -- hasVulnerability
RETURN p
```

The filter registry is a plain object:

```ts
export const filterRegistry: Record<string, CypherFilter> = {
  publicStart:      { startWhere: 'start.publicExposed = true' },
  sinkEnd:          { endWhere: 'end.kind IN ["rds", "sql"]' },
  hasVulnerability: { pathWhere: 'any(n IN nodes(p) WHERE n.hasVulnerability = true)' },
};
```

**Adding a new filter = adding one entry to this object.** `AVAILABLE_FILTERS`, error messages, and Swagger docs all derive automatically.

---

## Design Decisions

**Neo4j for graph storage.**
In-memory DFS enumerates all paths — exponential in the worst case, and the graph must fit in RAM. Neo4j is a native graph database: Cypher `[:CALLS*]` traverses edges at the storage layer, plans indexes automatically, and handles graphs with millions of nodes without loading them all into memory.

**Hash-based seed optimisation.**
Seeding the graph from JSON on every server startup would be slow and wasteful. Instead, `GraphLoader` computes a SHA-256 hash of the JSON file. `GraphImporter` checks a `GraphMeta` node in Neo4j; if the hash matches, the seed is skipped entirely. Re-seeding only happens when the source file changes.

**Atomic seed transaction.**
The entire seed (delete existing nodes, create nodes, create edges, write hash) runs inside a single Neo4j write transaction. If any step fails, nothing is persisted — the database stays consistent.

**Node uniqueness in cyclic graphs.**
Neo4j's `[:CALLS*]` uses relationship-uniqueness by default (no relationship repeated), but nodes *can* repeat in cyclic graphs. The `ALL(n IN nodes(p) WHERE single(x IN nodes(p) WHERE x = n))` WHERE clause enforces that each node appears at most once per path, matching the semantics of a DFS with a visited set.

**Configurable path depth.**
`MAX_PATH_DEPTH` defaults to 20 (covers all practical microservice call depths) but can be overridden via `MAX_PATH_DEPTH` env var without a code change.

**Subgraph response format.**
`/routes` returns `{ nodes[], edges[] }` — the deduplicated union of all matching paths. This is directly consumable by graph rendering libraries (React Flow, D3, Cytoscape).

**AND filter composition.**
Most useful default for security analysis. "Public entry → database → vulnerability" is one Cypher query, not three intersected result sets.

**`sqs` is not a sink.**
Message queues are intermediaries, not data stores. Only `rds` and `sql` are treated as sinks.

---

## Tradeoffs

| Decision | Alternative | Why not |
|---|---|---|
| Neo4j Cypher path queries | In-memory DFS | DFS is O(V+E) per path, exponential total; OOMs on large graphs |
| Hash-based seed skip | Re-seed on every startup | Unnecessary write load; startup latency grows with graph size |
| Atomic write transaction | Individual Cypher statements | Partial seed leaves DB in inconsistent state on failure |
| AND filter logic | OR / query DSL | OR requires client-side merging; a DSL adds complexity with no gain |
| Filters as Cypher fragments | Filters as JS predicates | JS predicates require loading all paths into memory first |

---

## Running Tests

```bash
npx nx test api          # 16 unit tests (GraphLoader, GraphImporter, GraphService, filters)
npx nx e2e api-e2e       # 20 E2E tests (requires Neo4j running + built dist/)
```

---

## Tech Stack

- **TypeScript** + **Node.js**
- **NestJS** — framework (modules, DI, lifecycle hooks)
- **Neo4j** — native graph database (Cypher path queries)
- **NX** — monorepo build tooling
- **Swagger / OpenAPI** — auto-generated API docs at `/docs`
- **Jest** — unit tests + E2E tests
- **Docker Compose** — Neo4j local development setup
