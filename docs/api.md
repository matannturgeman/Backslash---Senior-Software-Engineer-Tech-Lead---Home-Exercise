# API Reference

Base URL: `http://localhost:3000/api`

Interactive docs (Swagger UI): `http://localhost:3000/api`

---

## Endpoints

### `GET /graph`

Returns the **full graph** — all nodes and all edges.

**Response:**
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

### `GET /graph/routes`

Returns a **filtered subgraph** — only nodes and edges that participate in at least one route matching all specified filters.

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `filters` | `string` (comma-separated) | One or more filter names to apply |

**Available filter names:**

| Value | Description |
|---|---|
| `publicStart` | Route starts at a `publicExposed: true` node |
| `sinkEnd` | Route ends at an `rds` or `sql` node |
| `hasVulnerability` | Route passes through a node with at least one vulnerability |

**Example requests:**

```
GET /api/graph/routes?filters=publicStart
GET /api/graph/routes?filters=sinkEnd
GET /api/graph/routes?filters=publicStart,sinkEnd
GET /api/graph/routes?filters=publicStart,sinkEnd,hasVulnerability
```

**Response** (same shape as `/graph`, but only matching nodes and edges):
```json
{
  "nodes": [...],
  "edges": [...]
}
```

**Error responses:**

| Status | Reason |
|---|---|
| `400 Bad Request` | Unknown filter name provided |
| `422 Unprocessable Entity` | `filters` param is missing or empty |

---

## Response Shape — Graph Object

Both endpoints return the same `Graph` shape, usable directly by client-side graph rendering libraries (e.g., React Flow, D3, Cytoscape).

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
  metadata?: Record<string, unknown>;
}
```
