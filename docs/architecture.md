# Architecture

## Module Breakdown (NestJS)

```
apps/api/src/app/
  graph/
    graph.module.ts           ← NestJS module
    graph.controller.ts       ← REST endpoints: GET /graph, GET /graph/routes
    graph.service.ts          ← Orchestrates loader + pathFinder + filters
    graph.loader.ts           ← Reads & parses JSON, normalizes edges
    graph.path-finder.ts      ← DFS: finds all simple paths in the graph
  filters/
    filter.interface.ts       ← FilterFn type definition
    filter.registry.ts        ← Map of name → FilterFn
    public-start.filter.ts
    sink-end.filter.ts
    has-vulnerability.filter.ts

libs/shared/types/
  graph.types.ts              ← GraphNode, GraphEdge, Route, Graph interfaces
```

---

## Data Flow

```
JSON file
   │
   ▼
GraphLoader          — parses nodes[], normalizes edges to {from, to}[]
   │
   ▼
GraphService         — builds adjacency map {nodeName → [neighborNames]}
   │
   ├─── GET /graph   — returns all nodes + edges directly
   │
   └─── GET /graph/routes?filters=...
           │
           ▼
        PathFinder   — DFS to find all simple paths
           │
           ▼
        FilterRegistry.resolve(filterNames) → FilterFn[]
           │
           ▼
        Apply filters (AND) to each path
           │
           ▼
        Collect union of nodes + edges from matching paths
           │
           ▼
        Return subgraph { nodes[], edges[] }
```

---

## Filter System Design

```ts
// filter.interface.ts
type FilterFn = (path: GraphNode[]) => boolean;

// filter.registry.ts
const registry: Record<string, FilterFn> = {
  publicStart: (path) => path[0]?.publicExposed === true,
  sinkEnd:     (path) => ["rds", "sql"].includes(path.at(-1)?.kind),
  hasVulnerability: (path) => path.some(n => n.vulnerabilities?.length > 0),
};

// To add a new filter: add one entry to registry. That's it.
```

Filters compose via AND:
```ts
const composed = (path) => filters.every(fn => fn(path));
```

---

## Path Finding

Uses **iterative DFS** with a visited set to find all **simple paths** (no repeated nodes) in the directed graph.

- Graph size (~40 nodes, ~100 edges) makes full path enumeration feasible without optimization.
- Paths are computed on each request (graph is static/in-memory, so this is fast).

---

## Assumptions

1. **"Route" = full directed path**, not just a single edge. This aligns with the filter semantics (start node, end node, intermediate nodes).
2. **Sink** = any node with `kind: "rds"` or `kind: "sql"`. The `sqs` kind is treated as a message broker, not a sink, unless specified otherwise.
3. **Graph is static** — loaded once at startup from the JSON file. No persistence layer needed.
4. **Filter logic is AND** — all specified filters must match a route for it to be included.
5. **Subgraph response** — the `/routes` endpoint returns only nodes and edges that appear in at least one matching route, not the full route list. This is the most useful shape for client-side graph rendering.
