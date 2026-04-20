# Remaining Work — Phase 7: Production Readiness

Six items remain before this service is production-grade. Each is self-contained and can be implemented independently.

---

## 1. Neo4j Unique Constraint on `node.name`

**File:** `apps/api/src/app/graph/graph.importer.ts`

**Problem**
`graph.importer.ts` creates an _index_ on `n.name`, not a _constraint_. An index speeds up lookups but does not prevent duplicate nodes. If the JSON contains two nodes with the same name, both are silently written; any subsequent `MATCH (n:Node {name: ...})` may return multiple results, corrupting path queries.

**Fix**
Replace the `CREATE INDEX` call with a uniqueness constraint:

```cypher
-- current
CREATE INDEX node_name IF NOT EXISTS FOR (n:Node) ON (n.name)

-- replace with
CREATE CONSTRAINT node_name_unique IF NOT EXISTS
  FOR (n:Node) REQUIRE n.name IS UNIQUE
```

A unique constraint implies an index, so query performance is unchanged. Any duplicate name in the JSON will now throw `ConstraintViolationException` at seed time instead of silently corrupting data.

---

## 2. Runtime Zod Validation in `mapNode`

**File:** `apps/api/src/app/graph/graph.service.ts` — `mapNode()` (line ~101)

**Problem**
`mapNode` casts Neo4j property bags directly to `GraphNode` with `as string`, `as boolean`, etc. If a node was inserted manually into Neo4j with an invalid `kind` (e.g. `"mysql"`), or `vulnerabilities` is a malformed JSON string, the cast succeeds silently and the API returns corrupt data — or throws an unhandled `JSON.parse` exception mid-request.

**Fix**
Export `graphNodeSchema` from `graph.loader.ts` (or move it to `libs/shared/validation-schemas`) and parse the mapped object through it:

```typescript
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
```

A `ZodError` here surfaces as a 500 with a clear schema mismatch message rather than a silent bad response.

---

## 3. Fail-Fast on Dangling Edge Targets

**File:** `apps/api/src/app/graph/graph.importer.ts` — `seed()` (line ~75)

**Problem**
When an edge references a `to` node that doesn't exist in the JSON, the importer logs a warning but still passes the edge to the Cypher `UNWIND`. The `MATCH (a:Node {name: e.from}), (b:Node {name: e.to})` finds nothing and silently drops the relationship. The graph is seeded with missing edges and no indication that data was lost.

**Fix — strict (recommended for a static file):**
Throw at seed time so a bad JSON file is caught immediately:

```typescript
const dangling = this.loader.edges.filter(e => !nodeNames.has(e.to));
if (dangling.length > 0) {
  throw new Error(
    `Seed aborted — ${dangling.length} edge(s) reference unknown nodes: ` +
    dangling.map(e => `"${e.from}" → "${e.to}"`).join(', ')
  );
}
```

**Fix — lenient (for dynamic/partial graphs):**
Filter invalid edges before the `UNWIND` and log each one:

```typescript
const validEdges = this.loader.edges.filter(e => {
  if (!nodeNames.has(e.to)) {
    this.logger.warn(`Dropping edge to unknown node: "${e.from}" → "${e.to}"`);
    return false;
  }
  return true;
});
// pass validEdges to the UNWIND instead of this.loader.edges
```

---

## 4. Result-Set Protection

**File:** `apps/api/src/app/graph/graph.service.ts` — `getFilteredGraph()`

**Problem**
The Cypher query has no row limit. On a large or highly connected graph, `[:CALLS*1..20]` can return millions of paths. All are buffered into memory inside the `for (const record of result.records)` loop before the response is sent. This will OOM the process or time out the request.

**Fix — two layers:**

**Layer 1 — Cypher-level limit** (prevents Neo4j from returning excessive rows):
```typescript
`MATCH p = (start:Node)-[:CALLS*1..${maxDepth}]->(end:Node)
 WHERE ${conditions.join(' AND ')}
 RETURN p LIMIT ${MAX_RESULT_PATHS}`
```
`MAX_RESULT_PATHS` defaults to `10_000`, configurable via `MAX_RESULT_PATHS` env var.

**Layer 2 — response guard** (protects against unexpectedly large deduplicated graphs):
```typescript
if (nodeMap.size > MAX_RESPONSE_NODES) {
  throw new BadRequestException(
    `Result contains ${nodeMap.size} nodes — add more filters to narrow the query.`
  );
}
```

---

## 5. Health Endpoint

**Files to create:**
- `apps/api/src/app/health/health.module.ts`
- `apps/api/src/app/health/health.controller.ts`

**Problem**
There is no way for a load balancer, Kubernetes liveness probe, or on-call engineer to check whether the service can reach Neo4j and Redis.

**Fix**
Add `GET /health` using `@nestjs/terminus`:

```typescript
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private neo4j: Neo4jHealthIndicator,   // custom indicator
    private redis: RedisHealthIndicator,   // custom indicator
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.neo4j.isHealthy('neo4j'),
      () => this.redis.isHealthy('redis'),
    ]);
  }
}
```

Each custom indicator runs a lightweight probe (`RETURN 1` for Neo4j, `PING` for Redis) and returns `{ status: 'up' | 'down' }`.

**Response shapes:**
```json
// healthy
{ "status": "ok", "details": { "neo4j": { "status": "up" }, "redis": { "status": "up" } } }

// degraded (Redis down, cache bypassed — service still usable)
{ "status": "ok", "details": { "neo4j": { "status": "up" }, "redis": { "status": "down" } } }

// critical (Neo4j down — no queries possible)
{ "status": "error", "details": { "neo4j": { "status": "down" } } }
```

---

## 6. Testcontainers-Based E2E in CI

**File:** `apps/api-e2e/src/setup.ts` (new)

**Problem**
The existing E2E suite (`apps/api-e2e/src/api/api.spec.ts`) requires a live Neo4j and a pre-built `dist/`. In CI this means either a fragile Docker Compose setup or skipping E2E entirely.

**Fix**
Use `@testcontainers/neo4j` and `@testcontainers/redis` to spin up real, ephemeral instances scoped to the test run:

```typescript
// apps/api-e2e/src/setup.ts
import { Neo4jContainer } from '@testcontainers/neo4j';
import { RedisContainer } from '@testcontainers/redis';

let neo4j: StartedNeo4jContainer;
let redis: StartedRedisContainer;

beforeAll(async () => {
  [neo4j, redis] = await Promise.all([
    new Neo4jContainer('neo4j:5').start(),
    new RedisContainer('redis:7').start(),
  ]);

  process.env.NEO4J_URI  = neo4j.getBoltUri();
  process.env.NEO4J_USER = neo4j.getUsername();
  process.env.NEO4J_PASS = neo4j.getPassword();
  process.env.REDIS_HOST = redis.getHost();
  process.env.REDIS_PORT = String(redis.getMappedPort(6379));
}, 60_000);

afterAll(() => Promise.all([neo4j?.stop(), redis?.stop()]));
```

**Packages to install:**
```bash
pnpm add -D @testcontainers/neo4j @testcontainers/redis
```

**CI workflow** (`.github/workflows/test.yml`):
```yaml
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: npx nx test api

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: npx nx build api
      - run: npx nx e2e api-e2e
      # Docker is available on ubuntu-latest by default — no extra setup needed
```

Unit tests run on every push. E2E run on PRs and `main`. No shared infra, no flakiness from stale container state.
