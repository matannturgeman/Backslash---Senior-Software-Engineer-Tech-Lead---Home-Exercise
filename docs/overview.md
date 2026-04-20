# Project Overview

## What We're Building

A RESTful backend API that loads a microservices graph from a JSON file and exposes a **query engine** on top of it.

The graph represents the [Train Ticket](https://github.com/FudanSELab/train-ticket) microservices system — nodes are services or infrastructure resources (e.g., RDS), and edges are directed service-to-service calls.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript |
| Runtime | Node.js |
| Framework | NestJS (via NX monorepo) |
| API Docs | Swagger (auto-generated) |
| Testing | Jest |
| Monorepo | NX |

---

## Repository Structure

```
apps/
  api/                  ← NestJS backend (entry point)
libs/
  server/               ← Shared server-side modules
  shared/               ← Shared types, DTOs, validation schemas
docs/                   ← This documentation
requirments/            ← Original assignment files
```

---

## Key Concepts

### Node
A microservice or infrastructure resource in the graph.

```ts
{
  name: string;
  kind: "service" | "rds" | "sqs" | "sql";
  publicExposed?: boolean;         // true = internet-facing
  vulnerabilities?: Vulnerability[]; // security findings
  language?: string;
  path?: string;
  metadata?: Record<string, unknown>;
}
```

### Edge
A directed call from one service to another.

```ts
{ from: string; to: string }  // normalized from the raw JSON (to can be string | string[])
```

### Route
A directed **path** (sequence of nodes connected by edges) through the graph, found via DFS. Routes are the unit on which filters are applied.

---

## Filters

Filters are applied at the **route** level. A route must satisfy **all** specified filters (AND logic).

| Filter name | Description |
|---|---|
| `publicStart` | Route's first node has `publicExposed: true` |
| `sinkEnd` | Route's last node has `kind: "rds"` or `"sql"` |
| `hasVulnerability` | At least one node in the route has `vulnerabilities.length > 0` |

Filters are registered in a central registry — adding a new filter requires only adding one function.
