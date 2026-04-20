# Project Overview

## What This Is

A RESTful backend API that loads a microservices graph from a JSON file, seeds it into **Neo4j**, and exposes a **graph query engine** over it.

The graph represents the [Train Ticket](https://github.com/FudanSELab/train-ticket) microservices system — nodes are services or infrastructure resources (RDS, SQS, SQL), and directed edges represent service-to-service calls.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Language | TypeScript | 5.9 |
| Runtime | Node.js | 20 LTS |
| Framework | NestJS | 11 |
| Monorepo | NX + Webpack | 22 |
| Graph Database | Neo4j | 5 |
| Cache | Redis | 7 |
| Validation | Zod | 4 |
| API Docs | Swagger / OpenAPI | — |
| Testing | Jest + Testcontainers | — |

---

## Repository Structure

```
apps/
  api/                    ← NestJS backend (main application)
    src/app/
      graph/              ← Core query engine (controller, service, loader, importer)
      filters/            ← Composable Cypher filter registry
      cache/              ← Redis cache-aside service
      neo4j/              ← Neo4j driver module
      health/             ← Liveness probe endpoint
  api-e2e/                ← E2E tests (Testcontainers: real Neo4j + Redis)
libs/
  shared/types/           ← GraphNode, GraphEdge, CypherFilter, Vulnerability types
  shared/validation-schemas/ ← Zod schemas
docs/                     ← This documentation
```

---

## Key Concepts

### Node
A microservice or infrastructure resource.

```ts
{
  name: string;                        // unique identifier
  kind: "service" | "rds" | "sqs" | "sql";
  publicExposed?: boolean;             // true = internet-facing entry point
  vulnerabilities?: Vulnerability[];   // security findings
  language?: string;
  path?: string;
  metadata?: Record<string, unknown>;
}
```

### Edge
A directed call from one service to another.

```ts
{ from: string; to: string }
// Raw JSON allows `to: string | string[]` — normalized to flat GraphEdge[] at load time
```

### Filter
A named set of Cypher `WHERE` conditions that constrains which paths are returned.
Filters compose with **AND logic** — a path must satisfy every filter to be included.

| Filter name | Description |
|---|---|
| `publicStart` | Path starts at a node with `publicExposed = true` |
| `sinkEnd` | Path ends at an `rds` or `sql` node |
| `hasVulnerability` | At least one node in the path has `hasVulnerability = true` |

---

## Data File

The bundled dataset is `apps/api/src/assets/train-ticket.json`:
- **46 nodes** (30+ Java microservices, RDS databases, SQS queues, SQL databases)
- **98 directed edges**

---

## API Endpoints (Summary)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/graph` | Full graph (all nodes + edges) |
| `GET` | `/api/graph/filters` | List available filter names |
| `GET` | `/api/graph/routes?filters=...` | Filtered subgraph |
| `GET` | `/api/health` | Liveness probe (Neo4j + Redis) |

See [api.md](./api.md) for full reference.
