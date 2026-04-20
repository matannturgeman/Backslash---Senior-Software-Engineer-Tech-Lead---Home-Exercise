# Design Decisions

Key architectural choices made in this implementation, with rationale.

---

## 1. Neo4j as the Graph Store (not in-memory DFS)

**Decision:** Use Neo4j as the primary data store and execute path queries with Cypher, rather than loading the graph into a JS object and running DFS in Node.js.

**Why:**
- DFS enumerates **all simple paths**, which grows exponentially with graph density. For even a moderately connected 50-node graph, this can produce millions of paths and exhaust Node.js heap memory.
- Neo4j's Cypher `[:CALLS*]` traversal uses relationship-uniqueness pruning *during* traversal — it only materialises paths that satisfy the `WHERE` clause, never loading everything into RAM.
- Neo4j scales to graphs with millions of nodes without application-layer changes.
- The graph query and filter logic become declarative Cypher, easier to reason about than nested DFS with predicate stacks.

**Trade-off:** Adds operational complexity (Docker dependency, seed logic). Acceptable for a production-grade system.

---

## 2. Hash-Based Seed Optimisation

**Decision:** On startup, compare the SHA-256 hash of `train-ticket.json` against the hash stored in Neo4j (`GraphMeta` node). Re-seed only if the hash has changed.

**Why:**
- Seeding 46 nodes and 98 edges on every restart is cheap *now*, but the pattern should be correct by design for larger graphs.
- Deleting and recreating all nodes inside a transaction takes write locks. Skipping it when nothing changed avoids unnecessary load and cache invalidation on every container restart.

**How it works:**
```
hash(file) == stored hash  →  skip (fast path, read-only)
hash(file) != stored hash  →  wipe + re-seed (write transaction)
```

---

## 3. Atomic Write Transaction for Seeding

**Decision:** The entire seed operation (delete all, create nodes, create edges, update meta hash) runs inside a single Neo4j write transaction.

**Why:**
- If any step fails (e.g. a CREATE hits the unique constraint), the entire transaction rolls back. The database is never left in a partially-seeded state.
- This guarantees that either the full graph is available, or the old graph is still intact — no partial updates visible to concurrent reads.

---

## 4. Cypher Filters (not JS Predicates)

**Decision:** Filters are expressed as Cypher `WHERE` fragments that run inside the database, rather than JS functions applied to paths after retrieval.

**Why:**
- JS predicates require fetching **all paths** from Neo4j first, then filtering in Node.js. For a densely connected graph this is prohibitive.
- Cypher filters push the predicate into the traversal engine. Neo4j prunes non-matching paths *during* traversal — paths that don't satisfy `startWhere` are never explored further.
- Adding a new filter requires one line in `filter.registry.ts`. No changes to query-building logic, validation, error messages, or documentation are needed.

**Example — all three filters in one Cypher query:**
```cypher
MATCH p = (start:Node)-[:CALLS*1..20]->(end:Node)
WHERE
  ALL(n IN nodes(p) WHERE single(x IN nodes(p) WHERE x = n))
  AND start.publicExposed = true
  AND end.kind IN ["rds", "sql"]
  AND any(n IN nodes(p) WHERE n.hasVulnerability = true)
RETURN p LIMIT 10000
```

---

## 5. AND Filter Composition

**Decision:** Multiple filters compose with AND logic — a path must satisfy all filters to be included.

**Why:**
- The primary use case is security analysis: *"find paths from the internet to a database that pass through a vulnerable service"*. This is inherently an AND query.
- OR logic would produce much larger result sets (union of each filter independently) with less actionable signal.
- AND is simpler to implement in Cypher (just concatenate `WHERE` clauses).

**Trade-off:** A future OR / grouping DSL would require a more complex query builder. Deferred as a future extension.

---

## 6. Node Uniqueness Constraint in Path Queries

**Decision:** Add `ALL(n IN nodes(p) WHERE single(x IN nodes(p) WHERE x = n))` to every path query.

**Why:**
- Cypher `[:CALLS*]` by default uses **relationship-uniqueness**: no relationship is repeated, but a *node* can appear multiple times in a path. In a graph with cycles (A→B→A→C), this produces paths with repeated nodes.
- For security analysis, a path like `frontend → auth-service → frontend → db` is meaningless. Paths should be *simple* (no repeated nodes), matching the semantics of DFS with a visited set.
- The `ALL(... single(...))` clause enforces this at the Cypher level, avoiding application-layer deduplication.

---

## 7. Subgraph Response Format (not a list of paths)

**Decision:** `/graph/routes` returns a deduplicated subgraph `{ nodes[], edges[] }` — the union of all nodes and edges that appear in any matching path — rather than a list of paths.

**Why:**
- Graph rendering libraries (React Flow, D3, Cytoscape) consume `{ nodes, edges }` natively. Returning a flat list of paths would require the client to deduplicate.
- The subgraph is the most compact representation: N paths sharing many nodes produce far fewer unique nodes than the total path count × average path length.
- It directly answers the question *"which parts of the system are relevant to this risk?"*.

---

## 8. Graceful Redis Degradation

**Decision:** If Redis is unavailable, the API continues functioning with direct Neo4j queries. Cache operations are silently skipped.

**Why:**
- Redis is a performance optimisation, not a correctness requirement. The system is fully correct without it.
- Forcing a hard dependency on Redis would cause the API to fail even when Neo4j (the source of truth) is healthy.
- The `available` flag prevents premature reads/writes before the connection handshake completes — avoiding silent null results during startup.

**Implementation:**
```ts
client.on('connect', () => (this.available = true));
client.on('error',   () => (this.available = false));

async get(key) {
  if (!this.available) return null;   // bypass, not error
  ...
}
```

---

## 9. Result-Set Protection (Two Layers)

**Decision:** Apply two independent limits to prevent unbounded response sizes.

| Layer | Mechanism | Default |
|---|---|---|
| 1 | Cypher `LIMIT MAX_RESULT_PATHS` | 10,000 paths |
| 2 | Post-dedup node count guard → 400 | 5,000 nodes |

**Why:**
- Layer 1 prevents Neo4j from returning an unbounded stream of records.
- Layer 2 catches the case where 10,000 paths with many unique nodes produce a response that would overwhelm the client (serialisation, network, rendering).
- Two layers are better than one: Cypher LIMIT is a blunt instrument (path count ≠ node count); the node guard is semantically correct.
- Returning 400 with "add more filters" is more useful than silently truncating — truncated results would be misleading for security analysis.

---

## 10. `hasVulnerability` Denormalisation in Neo4j

**Decision:** Store a boolean `hasVulnerability` property directly on Neo4j nodes, in addition to the full `vulnerabilities` JSON string.

**Why:**
- The `hasVulnerability` filter uses `any(n IN nodes(p) WHERE n.hasVulnerability = true)`, which runs for every node in every candidate path.
- If the filter had to `JSON.parse(n.vulnerabilities)` and check `array.length > 0` in Cypher, it would be both slower (string parsing per node) and more complex.
- The boolean is derived at seed time (`vulnerabilities.length > 0`) and never needs to be updated independently — zero maintenance cost.

---

## 11. ConfigService (not `process.env` direct access)

**Decision:** All environment variables are read via NestJS `ConfigService`, not accessed directly through `process.env`.

**Why:**
- `ConfigService` integrates with NestJS's DI system, making values injectable and mockable in tests.
- Centralises default values (`config.get('PORT', 3000)`).
- Makes it easy to switch to `.env` files, config schemas, or remote config sources in the future without changing call sites.

---

## 12. NX Monorepo

**Decision:** Structure the project as an NX monorepo with `apps/` and `libs/`.

**Why:**
- Allows shared types (`@libs/shared-types`) and validation schemas to be imported by both the API app and tests without duplication.
- NX provides consistent build, test, and lint commands across all packages.
- Supports future addition of a frontend or additional backend services in the same repo with incremental builds.
