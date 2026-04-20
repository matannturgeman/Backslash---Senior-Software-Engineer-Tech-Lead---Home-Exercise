# Data Model

## Core Types

### `GraphNode`

```ts
interface GraphNode {
  name: string;                        // unique identifier (e.g. "frontend", "auth-service")
  kind: 'service' | 'rds' | 'sqs' | 'sql';
  publicExposed?: boolean;             // true = reachable directly from the internet
  vulnerabilities?: Vulnerability[];   // security findings discovered in this service
  language?: string;                   // e.g. "java"
  path?: string;                       // source code path, e.g. "train-ticket/frontend"
  metadata?: Record<string, unknown>;  // arbitrary extra properties
}
```

### `GraphEdge`

```ts
interface GraphEdge {
  from: string;  // source node name
  to: string;    // target node name
}
// A directed edge means: node `from` calls / depends on node `to`
```

### `Graph`

```ts
interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
```

### `Vulnerability`

```ts
interface Vulnerability {
  file: string;                        // source file where the finding was detected
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;                     // human-readable description
  metadata?: Record<string, unknown>;  // e.g. { cwe: "CWE-89: SQL Injection" }
}
```

### `CypherFilter`

```ts
interface CypherFilter {
  startWhere?: string;  // Cypher condition on the start node (bound as `start`)
  endWhere?: string;    // Cypher condition on the end node (bound as `end`)
  pathWhere?: string;   // Cypher condition on the full path (bound as `p`)
}
```

---

## Node Kinds

| Kind | Description | Acts as sink? |
|---|---|---|
| `service` | A Java microservice | No |
| `rds` | Relational database (Postgres, MySQL) | **Yes** |
| `sql` | Direct SQL database | **Yes** |
| `sqs` | AWS SQS message queue | No (intermediary) |

> `sqs` is intentionally not a sink — message queues are intermediaries, not data stores.

---

## Raw JSON Schema (train-ticket.json)

The source file uses a slightly looser format to allow compact edge definitions. `GraphLoader` normalises it on startup.

```ts
// Raw (on disk):
{
  nodes: Array<GraphNode>,
  edges: Array<{
    from: string,
    to: string | string[]   // array shorthand for multiple targets from one source
  }>
}

// Normalised (in memory / Neo4j):
{
  nodes: GraphNode[],
  edges: GraphEdge[]          // to is always a single string
}
```

**Example raw → normalised:**
```json
// Raw
{ "from": "gateway-service", "to": ["auth-service", "order-service"] }

// Normalised
{ "from": "gateway-service", "to": "auth-service" }
{ "from": "gateway-service", "to": "order-service" }
```

---

## Neo4j Property Mapping

Neo4j stores only primitive values. Complex properties are serialised:

| `GraphNode` field | Neo4j property | Type in Neo4j |
|---|---|---|
| `name` | `name` | `string` (UNIQUE constraint) |
| `kind` | `kind` | `string` |
| `publicExposed` | `publicExposed` | `boolean` (default: `false`) |
| `vulnerabilities` | `vulnerabilities` | `string` (JSON array) |
| `hasVulnerability` | `hasVulnerability` | `boolean` — derived: `vulnerabilities.length > 0` |
| `language` | `language` | `string \| null` |
| `path` | `path` | `string \| null` |
| `metadata` | `metadata` | `string` (JSON object) \| `null` |

> `hasVulnerability` is a denormalised boolean stored directly on the Neo4j node so Cypher filters can reference it without parsing the JSON array during traversal.

When reading from Neo4j, `vulnerabilities` and `metadata` are `JSON.parse()`d back to objects and validated through the Zod `graphNodeSchema`.

---

## Dataset: train-ticket.json

The bundled dataset is the [Train Ticket](https://github.com/FudanSELab/train-ticket) microservices architecture — a real-world e-commerce booking system used as a benchmark in academic research.

### Counts

| Metric | Value |
|---|---|
| Total nodes | 46 |
| Total edges | 98 |
| `service` nodes | ~34 |
| `rds` nodes | ~8 |
| `sqs` nodes | ~2 |
| `sql` nodes | ~2 |
| Publicly exposed nodes | 1 (`frontend`) |
| Nodes with vulnerabilities | several (including `auth-service`) |

### Sample Nodes

```json
{
  "name": "frontend",
  "kind": "service",
  "language": "java",
  "path": "train-ticket/frontend",
  "publicExposed": true
}

{
  "name": "auth-service",
  "kind": "service",
  "publicExposed": false,
  "vulnerabilities": [
    {
      "file": "train-ticket/ts-auth-service/src/main/java/auth/service/impl/UserServiceImpl.java",
      "severity": "medium",
      "message": "Detected string concatenation with non-literal variable in SQL statement",
      "metadata": { "cwe": "CWE-22: Path Traversal" }
    }
  ]
}

{
  "name": "prod-postgresdb",
  "kind": "rds",
  "metadata": { "cloud": "AWS", "engine": "postgres", "version": "9.6" }
}
```

---

## Zod Validation Schemas

Schemas live in `apps/api/src/app/graph/graph.loader.ts` and are used both at startup (JSON parse) and at query time (Neo4j → `GraphNode`).

```ts
const vulnerabilitySchema = z.object({
  file:     z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  message:  z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const graphNodeSchema = z.object({
  name:            z.string().min(1),
  kind:            z.enum(['service', 'rds', 'sqs', 'sql']),
  publicExposed:   z.boolean().optional(),
  vulnerabilities: z.array(vulnerabilitySchema).optional(),
  language:        z.string().optional(),
  path:            z.string().optional(),
  metadata:        z.record(z.string(), z.unknown()).optional(),
});

// Raw edge (to can be array)
const rawEdgeSchema = z.object({
  from: z.string().min(1),
  to:   z.union([z.string().min(1), z.array(z.string().min(1))]),
});
```

Validation errors at startup are thrown with field-level detail and halt the process:
```
Graph file failed schema validation:
  [nodes.2.kind] Invalid enum value. Expected 'service' | 'rds' | 'sqs' | 'sql', received 'lambda'
```
