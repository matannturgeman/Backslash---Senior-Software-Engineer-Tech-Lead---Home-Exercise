# Implementation Plan

## Phase 1 — Foundation (done)
- [x] NX monorepo scaffold (NestJS API + shared libs)
- [x] Copy JSON data file to `apps/api/src/assets/train-ticket.json`
- [x] Add graph types to `libs/shared/types`: `GraphNode`, `GraphEdge`, `Graph`, `Route`, `FilterFn`
- [x] Strip AppModule of unused dependencies (Redis, TypeORM, Mongoose, Auth)

## Phase 2 — Graph Engine (done)
- [x] `GraphLoader` — reads JSON on startup, normalizes edges (`to: string | string[]` → flat `GraphEdge[]`), stores nodes in a `Map<name, GraphNode>`
- [x] `GraphImporter` — seeds Neo4j atomically; hash-based re-seed skipping
- [x] `GraphService` — Cypher path queries with composable filter conditions; deduplicates nodes/edges

## Phase 3 — Filter System (done)
- [x] `CypherFilter` type: `{ startWhere?, endWhere?, pathWhere? }`
- [x] `filterRegistry`: central map of `name → CypherFilter`
- [x] Built-in filters: `publicStart`, `sinkEnd`, `hasVulnerability`
- [x] Validation: unknown filter names → 400 Bad Request

## Phase 4 — REST API (done)
- [x] `GET /api/graph` — full graph
- [x] `GET /api/graph/filters` — list available filter names
- [x] `GET /api/graph/routes?filters=...` — filtered subgraph
- [x] Swagger docs at `/docs`
- [x] CORS enabled

## Phase 5 — Quality (done)
- [x] Unit tests: GraphLoader, GraphService, filter registry
- [x] E2E tests: all endpoints (20 tests)

## Phase 6 — Hardening (done)
- [x] `ConfigService` replaces all `process.env` reads (Neo4jModule, GraphService)
- [x] Zod schema validation for `train-ticket.json` on startup
- [x] Neo4j startup retry (4 attempts, 2 s delay, transient-errors only)
- [x] Redis caching with graceful degradation (`CacheService`)
- [x] Cache key constants extracted to `graph.cache-keys.ts`
- [x] `available=false` init fix — no cache reads before Redis handshake

## Phase 7 — Production Readiness (remaining)
See [`docs/remaining-work.md`](./remaining-work.md) for detail.

- [ ] Neo4j unique constraint on `node.name`
- [ ] Runtime Zod validation in `mapNode` (read path from Neo4j)
- [ ] Fail-fast on dangling edge targets at seed time
- [ ] Result-set protection (path `LIMIT`, max-node guard)
- [ ] `/health` endpoint (Neo4j + Redis liveness)
- [ ] Testcontainers-based E2E in CI

---

## Key Design Decisions

| Decision | Choice | Why |
|---|---|---|
| Path finding | Neo4j `[:CALLS*]` + `NODE_UNIQUENESS` clause | Cypher prunes during traversal; avoids loading all paths into memory |
| Filter composition | AND logic via Cypher `WHERE` join | Push-down filtering; most useful for security analysis |
| Response format | Deduplicated subgraph `{ nodes, edges }` | Client-renderable by React Flow / D3 / Cytoscape |
| Filter extensibility | Registry map of Cypher fragments | One object entry = new filter; validation/docs/composition derive automatically |
| Caching | Redis cache-aside, invalidated on re-seed | Graph is static between seeds; eliminates Neo4j round-trips on hot paths |
| Env config | NestJS `ConfigService` | Values resolved at runtime, not module-load time; testable |
