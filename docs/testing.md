# Testing

## Overview

| Layer | Runner | Location | Count |
|---|---|---|---|
| Unit | Jest (ts-jest) | `apps/api/src/` | 16 tests |
| E2E | Jest + Testcontainers | `apps/api-e2e/src/` | 20 tests |

---

## Unit Tests

### Running

```bash
npx nx test api
# with coverage
npx nx test api --coverage
# watch mode
npx nx test api --watch
```

### `GraphLoader` — `graph.loader.spec.ts`

Tests the JSON parsing and normalisation logic in isolation. `fs` is mocked so no real file I/O occurs.

**Covered behaviour:**
- Nodes are loaded into a `Map<name, GraphNode>`
- `to: string[]` edges are expanded to multiple `GraphEdge` entries
- `to: string` edges pass through unchanged
- The SHA-256 `fileHash` is computed from the raw JSON string

**Mock strategy:**
```ts
jest.mock('fs');
(fs.readFileSync as jest.Mock).mockReturnValue(MOCK_JSON);
```

### `GraphService` — `graph.service.spec.ts`

Tests Cypher query composition and result deduplication. `Neo4jService` is replaced with a Jest mock.

**Covered behaviour:**
- `getFullGraph` maps Neo4j records to `{ nodes, edges }`
- `getFilteredGraph` throws `400 BadRequestException` for unknown filter names
- Correct `startWhere` and `endWhere` fragments appear in the generated Cypher
- Nodes are deduplicated across multiple path records (Map keyed by `name`)
- Edges are deduplicated across segments (Set keyed by `from→to`)

**Mock strategy:**
```ts
const mockNeo4j = { run: jest.fn() };
// provide via NestJS testing module
{ provide: Neo4jService, useValue: mockNeo4j }
```

### Filter Registry — `filter.registry.spec.ts`

Validates the registry exports and that all declared filters are non-empty objects with at least one Cypher condition key.

---

## E2E Tests

### Requirements

- Docker must be running (Testcontainers spins up real containers)
- The app must be built first: `npx nx build api`

### Running

```bash
npx nx build api      # build once
npx nx e2e api-e2e    # run E2E suite
```

### Setup Lifecycle

```
globalSetup (global-setup.ts)
  │
  ├─ Start Neo4jContainer("neo4j:5")   ──┐ parallel
  ├─ Start RedisContainer("redis:7")   ──┘
  │
  ├─ Inject container connection details into process.env:
  │    NEO4J_URI, NEO4J_USER, NEO4J_PASS
  │    REDIS_HOST, REDIS_PORT
  │
  ├─ spawn("node dist/api/main.js", { env: process.env })
  │
  └─ waitForPortOpen(3000)   ← blocks until API is ready

testSetup (test-setup.ts)
  └─ axios.defaults.baseURL = `http://localhost:${PORT}`

globalTeardown (global-teardown.ts)
  ├─ Kill API server process
  └─ Stop Neo4j + Redis containers
```

### Test Groups

**`GET /api/graph` (4 tests)**
- Returns 200 with `{ nodes: [...], edges: [...] }` shape
- Returns exactly 46 nodes from `train-ticket.json`
- Returns exactly 98 edges
- Every node has `name: string` and `kind: string`

**`GET /api/graph/filters` (2 tests)**
- Returns 200 with `{ filters: string[] }`
- Array contains `publicStart`, `sinkEnd`, `hasVulnerability`

**Error cases — `GET /api/graph/routes` (4 tests)**
- Missing `filters` param → `400`
- Empty `filters` param (`?filters=`) → `400`
- Unknown filter name (`?filters=bogus`) → `400`, body mentions `"bogus"` and `"Available"`
- 400 message lists all valid filter names

**`filters=publicStart` (3 tests)**
- Returns 200 with valid graph shape
- All returned nodes are a subset of the full graph node set
- At least one node has `publicExposed: true`

**`filters=sinkEnd` (2 tests)**
- Returns 200 with valid graph shape
- At least one node has `kind === "rds"` or `kind === "sql"`

**`filters=hasVulnerability` (2 tests)**
- Returns 200 with valid graph shape
- At least one node has a non-empty `vulnerabilities` array

**Combined filters (4 tests)**
- `publicStart,sinkEnd` → 200 valid graph
- `publicStart,sinkEnd,hasVulnerability` → 200 valid graph
- `sinkEnd` response nodes have no duplicates (by `name`)
- `sinkEnd` response edges have no duplicates (by `from→to` key)

---

## Test Helpers (E2E)

Three type guards used across all E2E tests:

```ts
const isValidNode = (n) =>
  typeof n.name === 'string' && typeof n.kind === 'string';

const isValidEdge = (e) =>
  typeof e.from === 'string' && typeof e.to === 'string';

const isValidGraph = (data) =>
  Array.isArray(data.nodes) &&
  Array.isArray(data.edges) &&
  data.nodes.every(isValidNode) &&
  data.edges.every(isValidEdge);
```

---

## What Is Not Tested

| Area | Reason |
|---|---|
| `GraphImporter` unit tests | Seeding logic is fully covered by E2E (real Neo4j) |
| `CacheService` unit tests | Behaviour verified end-to-end; Redis is optional |
| `HealthController` | Not in current test suite; liveness verified manually |
| Load / performance tests | Out of scope for this exercise |

---

## Jest Configuration

```
apps/api/jest.config.cts        ← unit test config (ts-jest, paths via tsconfig)
apps/api-e2e/jest.config.ts     ← E2E config (globalSetup/Teardown, longer timeout)
jest.preset.js                  ← shared preset (NX)
jest.config.ts                  ← root config
```

TypeScript path aliases (`@libs/shared-types`, etc.) are resolved via `tsconfig.base.json` and passed through to `ts-jest` via `pathsToModuleNameMapper`.
