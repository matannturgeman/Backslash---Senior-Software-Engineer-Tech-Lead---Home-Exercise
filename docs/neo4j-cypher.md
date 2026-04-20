# Neo4j & Cypher Reference

All queries executed by the application, with explanations.

---

## Schema Setup

### Unique Constraint

```cypher
CREATE CONSTRAINT node_name_unique IF NOT EXISTS
FOR (n:Node) REQUIRE n.name IS UNIQUE
```

- Ensures no two nodes share the same `name`.
- Created after the seed transaction (DDL cannot run inside a write transaction in Neo4j).
- `IF NOT EXISTS` makes it idempotent — safe to run on every restart.

---

## Seed Queries

### Check Stored Hash

```cypher
MATCH (m:GraphMeta) RETURN m.hash AS hash
```

Returns the SHA-256 hash of the last seeded JSON file. If result is empty or hash differs from the current file, seeding proceeds.

### Wipe Existing Data

```cypher
MATCH (n:Node) DETACH DELETE n
MATCH (m:GraphMeta) DELETE m
```

`DETACH DELETE` removes the node and all its relationships in one step. Runs first inside the write transaction to ensure a clean slate.

### Create Nodes

```cypher
UNWIND $nodes AS n
CREATE (:Node {
  name:             n.name,
  kind:             n.kind,
  publicExposed:    coalesce(n.publicExposed, false),
  hasVulnerability: n.hasVulnerability,
  vulnerabilities:  n.vulnerabilities,
  language:         n.language,
  path:             n.path,
  metadata:         n.metadata
})
```

**Parameters:** `{ nodes: Array<NodeParams> }` where `vulnerabilities` and `metadata` are JSON strings.

`coalesce(n.publicExposed, false)` ensures the property is always a boolean, never null — important for Cypher filter `start.publicExposed = true`.

### Create Relationships

```cypher
UNWIND $edges AS e
MATCH (a:Node {name: e.from}), (b:Node {name: e.to})
CREATE (a)-[:CALLS]->(b)
```

**Parameters:** `{ edges: Array<{ from: string, to: string }> }`

`MATCH` is used (not `MERGE`) because nodes were just created and are guaranteed unique by the constraint. Using `MATCH` fails fast if a node is missing (dangling edge bug surfaced before the query runs).

### Store New Hash

```cypher
MERGE (m:GraphMeta) SET m.hash = $hash
```

**Parameters:** `{ hash: string }`

`MERGE` creates the node if absent, updates it if present. Runs at the end of the write transaction so the hash is only committed if all nodes and edges were created successfully.

---

## Read Queries

### Full Graph — Nodes

```cypher
MATCH (n:Node) RETURN n
```

Returns all node records. Properties are mapped via `graphNodeSchema.parse(r.get('n').properties)`.

### Full Graph — Edges

```cypher
MATCH (a:Node)-[:CALLS]->(b:Node)
RETURN a.name AS from, b.name AS to
```

Returns all directed edges as `{ from, to }` pairs.

Both queries run in parallel (`Promise.all`) for `GET /api/graph`.

### Filtered Subgraph

```cypher
MATCH p = (start:Node)-[:CALLS*1..{maxDepth}]->(end:Node)
WHERE
  ALL(n IN nodes(p) WHERE single(x IN nodes(p) WHERE x = n))
  [AND {startWhere}]
  [AND {endWhere}]
  [AND {pathWhere}]
RETURN p LIMIT {maxPaths}
```

**Variables:**

| Variable | Bound to |
|---|---|
| `p` | The full path |
| `start` | First node in the path |
| `end` | Last node in the path |
| `n` | Iterator in list comprehensions |

**Conditions assembled from filter registry:**

| Filter | Clause added |
|---|---|
| `publicStart` | `AND start.publicExposed = true` |
| `sinkEnd` | `AND end.kind IN ["rds", "sql"]` |
| `hasVulnerability` | `AND any(n IN nodes(p) WHERE n.hasVulnerability = true)` |

**Node uniqueness clause (always present):**
```cypher
ALL(n IN nodes(p) WHERE single(x IN nodes(p) WHERE x = n))
```
This enforces *simple paths* — no node appears more than once. Without it, Cypher's relationship-uniqueness allows cycles like A→B→A→C.

**Example — all three filters:**
```cypher
MATCH p = (start:Node)-[:CALLS*1..20]->(end:Node)
WHERE
  ALL(n IN nodes(p) WHERE single(x IN nodes(p) WHERE x = n))
  AND start.publicExposed = true
  AND end.kind IN ["rds", "sql"]
  AND any(n IN nodes(p) WHERE n.hasVulnerability = true)
RETURN p LIMIT 10000
```

### Health Check

```cypher
RETURN 1
```

Trivial query used by `HealthController` to verify the Neo4j connection is alive.

### Check Stored Hash (used by importer)

```cypher
MATCH (m:GraphMeta) RETURN m.hash AS hash
```

---

## Result Processing

The `RETURN p` clause returns path objects. Each path has a `.segments` array where each segment has `.start` and `.end` node objects:

```
path.segments = [
  { start: Node, end: Node },  // segment 0: start → node_1
  { start: Node, end: Node },  // segment 1: node_1 → node_2
  ...
]
```

Deduplication in `GraphService.getFilteredGraph()`:

```ts
const nodeMap = new Map<string, GraphNode>();   // keyed by name
const edgeSet = new Set<string>();              // keyed by "from→to"

for (const record of result.records) {
  for (const segment of record.get('p').segments) {
    const from = mapNode(segment.start.properties);
    const to   = mapNode(segment.end.properties);
    nodeMap.set(from.name, from);
    nodeMap.set(to.name, to);
    const key = `${from.name}→${to.name}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      edges.push({ from: from.name, to: to.name });
    }
  }
}
```

---

## Limits & Tuning

| Parameter | Env var | Default | Effect |
|---|---|---|---|
| Path depth | `MAX_PATH_DEPTH` | `20` | `[:CALLS*1..N]` max hops |
| Path count | `MAX_RESULT_PATHS` | `10000` | Cypher `LIMIT` |
| Node guard | `MAX_RESPONSE_NODES` | `5000` | Throws 400 if exceeded |

**Tuning guidance:**
- Increasing `MAX_PATH_DEPTH` beyond 20 rarely finds new paths in microservice graphs (call chains are typically 3–8 hops) but exponentially increases traversal cost.
- `MAX_RESULT_PATHS` caps memory usage on the Neo4j driver side. If legitimate queries hit this limit, add a more specific filter first.
- `MAX_RESPONSE_NODES` protects API consumers from oversized JSON payloads.
