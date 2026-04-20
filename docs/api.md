# API Reference

Base URL: `http://localhost:3000/api`

Interactive Swagger UI: `http://localhost:3000/docs`

---

## `GET /graph`

Returns the **full graph** — all 46 nodes and 98 edges from the loaded dataset.

**Cache key:** `graph:full`

**Response `200 OK`:**
```json
{
  "nodes": [
    {
      "name": "frontend",
      "kind": "service",
      "publicExposed": true,
      "language": "java",
      "path": "train-ticket/frontend"
    },
    {
      "name": "prod-postgresdb",
      "kind": "rds",
      "metadata": { "cloud": "AWS", "engine": "postgres", "version": "9.6" }
    }
  ],
  "edges": [
    { "from": "frontend", "to": "gateway-service" },
    { "from": "gateway-service", "to": "auth-service" }
  ]
}
```

---

## `GET /graph/filters`

Returns the **list of available filter names** that can be passed to `/graph/routes`.

**Response `200 OK`:**
```json
{
  "filters": ["publicStart", "sinkEnd", "hasVulnerability"]
}
```

---

## `GET /graph/routes`

Returns a **filtered subgraph** — the union of all nodes and edges that appear in at least one path matching **all** specified filters.

### Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `filters` | `string` (comma-separated) | Yes | One or more filter names |

### Example Requests

```
GET /api/graph/routes?filters=publicStart
GET /api/graph/routes?filters=sinkEnd
GET /api/graph/routes?filters=hasVulnerability
GET /api/graph/routes?filters=publicStart,sinkEnd
GET /api/graph/routes?filters=publicStart,sinkEnd,hasVulnerability
```

**Cache key:** `graph:filtered:<sorted-filter-names>` (e.g. `graph:filtered:publicStart,sinkEnd`)

**Response `200 OK`:** Same shape as `GET /graph`, but only matching nodes and edges.

### Error Responses

| Status | Trigger | Body |
|---|---|---|
| `400 Bad Request` | `filters` param missing or empty | `{ "message": "filters query param is required" }` |
| `400 Bad Request` | Unknown filter name | `{ "message": "Unknown filters: [foo]. Available: publicStart, sinkEnd, hasVulnerability" }` |
| `400 Bad Request` | Result exceeds `MAX_RESPONSE_NODES` | `{ "message": "Result too large (N nodes). Add more filters to narrow the query." }` |

---

## `GET /health`

Liveness probe — checks Neo4j and Redis connectivity.

**Response `200 OK` (all healthy):**
```json
{
  "status": "ok",
  "details": {
    "neo4j": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

**Response `200 OK` (Redis degraded — API still functional):**
```json
{
  "status": "ok",
  "details": {
    "neo4j": { "status": "up" },
    "redis": { "status": "down" }
  }
}
```

**Response `503 Service Unavailable` (Neo4j down):**
```json
{
  "status": "error",
  "details": {
    "neo4j": { "status": "down", "error": "Connection refused" }
  }
}
```

---

## Response Shape — Graph Object

Both `/graph` and `/graph/routes` return the same `Graph` shape, directly consumable by graph rendering libraries (React Flow, D3, Cytoscape).

```ts
interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface GraphNode {
  name: string;
  kind: "service" | "rds" | "sqs" | "sql";
  publicExposed?: boolean;
  vulnerabilities?: Vulnerability[];
  language?: string;
  path?: string;
  metadata?: Record<string, unknown>;
}

interface GraphEdge {
  from: string;
  to: string;
}

interface Vulnerability {
  file: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  metadata?: Record<string, unknown>;  // e.g. { cwe: "CWE-22: Path Traversal" }
}
```
