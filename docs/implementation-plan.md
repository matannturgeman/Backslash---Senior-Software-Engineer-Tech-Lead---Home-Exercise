# Implementation Plan

## Phase 1 — Foundation (done)
- [x] NX monorepo scaffold (NestJS API + shared libs)
- [x] Copy JSON data file to `apps/api/src/assets/train-ticket.json`
- [x] Add graph types to `libs/shared/types`: `GraphNode`, `GraphEdge`, `Graph`, `Route`, `FilterFn`
- [x] Strip AppModule of unused dependencies (Redis, TypeORM, Mongoose, Auth)

## Phase 2 — Graph Engine (done)
- [x] `GraphLoader` — reads JSON on startup, normalizes edges (`to: string | string[]` → flat `GraphEdge[]`), stores nodes in a `Map<name, GraphNode>`
- [x] `GraphPathFinder` — builds adjacency list; DFS to enumerate all simple paths (no cycles)
- [x] `GraphService` — orchestrates loader + path finder; exposes `getFullGraph()` and `getFilteredGraph(filterNames[])`

## Phase 3 — Filter System (done)
- [x] `FilterFn` type: `(route: GraphNode[]) => boolean`
- [x] `filterRegistry`: central map of `name → FilterFn`
- [x] Built-in filters: `publicStart`, `sinkEnd`, `hasVulnerability`
- [x] Validation: unknown filter names → 400 Bad Request

## Phase 4 — REST API (done)
- [x] `GET /api/graph` — full graph
- [x] `GET /api/graph/routes?filters=...` — filtered subgraph
- [x] Swagger docs at `/docs`
- [x] CORS enabled

## Phase 5 — Quality (todo)
- [ ] Unit tests: GraphLoader, GraphPathFinder, GraphService, each filter
- [ ] E2E tests: both endpoints
- [ ] README with setup instructions, assumptions, architecture notes

## Phase 6 — Polish (todo)
- [ ] Response caching (graph is static — cache route computation)
- [ ] `GET /api/graph/filters` endpoint listing available filter names
- [ ] Zod validation for query params

---

## Key Design Decisions

| Decision | Choice | Why |
|---|---|---|
| Path finding | DFS all simple paths | Filters are path-level (start, end, intermediate nodes) |
| Filter composition | AND logic | Most useful default for security analysis |
| Response format | Subgraph `{nodes, edges}` | Client-renderable by React Flow / D3 / Cytoscape |
| Graph storage | In-memory `Map` | Graph is static; no DB overhead needed |
| Filter extensibility | Registry map | Add one function = new filter; zero boilerplate |
| Route definition | Min 2 nodes | Single-node "paths" aren't routes |
