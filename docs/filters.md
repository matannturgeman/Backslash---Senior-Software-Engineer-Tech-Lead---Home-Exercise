# Filter System

Filters are the core extensibility mechanism of the query engine. Each filter is a named set of **Cypher WHERE fragments** that constrain which paths Neo4j returns. Filtering happens inside the database — no paths are materialised in Node.js only to be discarded.

---

## CypherFilter Type

```ts
// libs/shared/types/src/lib/types.ts
interface CypherFilter {
  startWhere?: string;  // condition evaluated on the path's start node (alias: `start`)
  endWhere?: string;    // condition evaluated on the path's end node (alias: `end`)
  pathWhere?: string;   // condition evaluated on the full path variable `p`
}
```

All fragments from all selected filters are collected and joined into a single Cypher `WHERE` clause with `AND`.

---

## Built-in Filters

### `publicStart`

**Cypher fragment:** `start.publicExposed = true`

**Effect:** Keeps paths whose **first node** is internet-facing.

**Use case:** Find all attack surfaces reachable from the internet.

---

### `sinkEnd`

**Cypher fragment:** `end.kind IN ["rds", "sql"]`

**Effect:** Keeps paths whose **last node** is a data store (Postgres, MySQL, SQL).

> Note: `sqs` (message queues) are treated as intermediaries, not sinks.

**Use case:** Find all paths that reach a database — useful for data exfiltration risk analysis.

---

### `hasVulnerability`

**Cypher fragment:** `any(n IN nodes(p) WHERE n.hasVulnerability = true)`

**Effect:** Keeps paths where **at least one node** has a known vulnerability.

**Use case:** Find all routes that touch a vulnerable service.

---

## Combining Filters

Specify multiple filters as a comma-separated `filters` query param. All selected filters are applied with **AND logic** — a path must satisfy every filter to be included.

**Example — paths from internet to a database through a vulnerable service:**
```
GET /api/graph/routes?filters=publicStart,sinkEnd,hasVulnerability
```

This generates a single Cypher query:
```cypher
MATCH p = (start:Node)-[:CALLS*1..20]->(end:Node)
WHERE
  ALL(n IN nodes(p) WHERE single(x IN nodes(p) WHERE x = n))  -- no repeated nodes
  AND start.publicExposed = true
  AND end.kind IN ["rds", "sql"]
  AND any(n IN nodes(p) WHERE n.hasVulnerability = true)
RETURN p LIMIT 10000
```

---

## Adding a New Filter

1. Add an entry to `apps/api/src/app/filters/filter.registry.ts`:

```ts
export const filterRegistry: Record<string, CypherFilter> = {
  publicStart:      { startWhere: 'start.publicExposed = true' },
  sinkEnd:          { endWhere:   'end.kind IN ["rds", "sql"]' },
  hasVulnerability: { pathWhere:  'any(n IN nodes(p) WHERE n.hasVulnerability = true)' },

  // New filter: paths longer than 3 hops
  deepPath: { pathWhere: 'length(p) > 3' },
};
```

2. That's it. No other changes needed. The new filter is:
   - Available via `?filters=deepPath`
   - Listed in `GET /graph/filters`
   - Validated against the registry (unknown names → 400)
   - Included in error messages that list available filters

---

## Result-Set Protection

Two safety limits apply after filtering:

| Limit | Default | Env var | Effect |
|---|---|---|---|
| `MAX_RESULT_PATHS` | 10,000 | `MAX_RESULT_PATHS` | Cypher `LIMIT` — caps rows returned from Neo4j |
| `MAX_RESPONSE_NODES` | 5,000 | `MAX_RESPONSE_NODES` | Post-dedup node count check — returns 400 if exceeded |

If `MAX_RESPONSE_NODES` is exceeded, the response tells the caller to add more filters.
