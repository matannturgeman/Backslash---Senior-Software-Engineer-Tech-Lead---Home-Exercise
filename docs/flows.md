# Data Flows

## Startup Sequence

```
NestJS bootstrap
       │
       ├─ Neo4jModule.forRoot()
       │     Create neo4j.Driver (bolt://...) — connection is lazy
       │
       ├─ CacheService.connect()
       │     Open Redis client
       │     on 'connect'  → available = true
       │     on 'error'    → available = false (graceful degradation)
       │
       ├─ GraphLoader.onModuleInit()          [Step 1]
       │     1. Read train-ticket.json from assets/
       │     2. JSON.parse()
       │     3. Validate with Zod rawGraphSchema
       │     4. Normalize edges: to: string | string[] → flat GraphEdge[]
       │     5. Store nodes in Map<name, GraphNode>
       │     6. Compute SHA-256 hash of raw JSON bytes
       │
       └─ GraphImporter.onModuleInit()        [Step 2 — retries 4×, 2s apart]
             1. Query Neo4j: MATCH (m:GraphMeta) RETURN m.hash
             2. Compare stored hash vs. current file hash
             3a. Hashes match → skip seed (fast path, no DB writes)
             3b. Hash differs or no meta node →
                   BEGIN write transaction
                     MATCH (n:Node) DETACH DELETE n      ← wipe existing
                     UNWIND nodes → CREATE (:Node {...})
                     Validate edges (fail-fast on dangling targets)
                     UNWIND edges → MATCH + CREATE [:CALLS]
                     MERGE (:GraphMeta) SET m.hash = newHash
                   COMMIT  ← atomic: all-or-nothing
                   Invalidate Redis: SCAN + DEL graph:*
```

Transient errors retried: `ECONNREFUSED`, `ENOTFOUND`, `ETIMEDOUT`, `ServiceUnavailable`, `SessionExpired`.

---

## `GET /api/graph` — Full Graph

```
GraphController.getGraph()
       │
       ▼
GraphService.getFullGraph()
       │
       ├─ cache key: "graph:full"
       ├─ CacheService.get("graph:full")
       │     Redis available + HIT  → return cached JSON ──► response
       │     Redis unavailable / MISS ↓
       │
       ├─ Neo4jService.run(
       │     "MATCH (n:Node) OPTIONAL MATCH (n)-[:CALLS]->(m:Node)
       │      RETURN n, m"
       │   )
       │
       ├─ Map Neo4j records → { nodes: GraphNode[], edges: GraphEdge[] }
       │
       ├─ CacheService.set("graph:full", graph, TTL=300s)
       │
       └─ return graph ──► 200 { nodes[], edges[] }
```

---

## `GET /api/graph/filters` — Available Filters

```
GraphController.getFilters()
       │
       └─ return { filters: Object.keys(filterRegistry) }
          // ["publicStart", "sinkEnd", "hasVulnerability"]
          ──► 200 { filters: string[] }
```

No Neo4j or Redis involved.

---

## `GET /api/graph/routes?filters=publicStart,sinkEnd` — Filtered Subgraph

```
GraphController.getRoutes("publicStart,sinkEnd")
       │
       ├─ Parse: ["publicStart", "sinkEnd"]
       ▼
GraphService.getFilteredGraph(["publicStart", "sinkEnd"])
       │
       ├─ Validate each name against filterRegistry
       │     unknown name → throw 400 with list of available names
       │
       ├─ Sort names → ["publicStart", "sinkEnd"]
       ├─ Cache key: "graph:filtered:publicStart,sinkEnd"
       │
       ├─ CacheService.get(key)
       │     HIT  → return cached subgraph ──► response
       │     MISS ↓
       │
       ├─ Collect Cypher conditions from each filter:
       │     publicStart.startWhere  → "start.publicExposed = true"
       │     sinkEnd.endWhere        → 'end.kind IN ["rds", "sql"]'
       │
       ├─ Build WHERE clause:
       │     ALL(n IN nodes(p) WHERE single(x IN nodes(p) WHERE x = n))
       │     AND start.publicExposed = true
       │     AND end.kind IN ["rds", "sql"]
       │
       ├─ Neo4jService.run(
       │     "MATCH p = (start:Node)-[:CALLS*1..20]->(end:Node)
       │      WHERE <conditions>
       │      RETURN p LIMIT 10000"
       │   )
       │
       ├─ Deduplicate nodes + edges from all path segments
       │     (a node/edge appearing in multiple paths is included once)
       │
       ├─ Guard: nodes.length > MAX_RESPONSE_NODES
       │     → throw 400 "Result too large. Add more filters."
       │
       ├─ CacheService.set(key, subgraph, TTL=300s)
       │
       └─ return subgraph ──► 200 { nodes[], edges[] }
```

---

## `GET /api/health` — Liveness Probe

```
HealthController.check()
       │
       ├─ Neo4j check: run "RETURN 1" query
       │     success → { neo4j: { status: "up" } }
       │     failure → { neo4j: { status: "down", error: "..." } }
       │
       ├─ Redis check: client.ping()
       │     success → { redis: { status: "up" } }
       │     failure → { redis: { status: "down" } }
       │
       ├─ All up        → 200 { status: "ok", details: { ... } }
       ├─ Redis down    → 200 { status: "ok", details: { ... } }  (degraded but ok)
       └─ Neo4j down   → 503 { status: "error", details: { ... } }
```

---

## Cache Invalidation on Re-seed

```
GraphImporter detects changed JSON hash
       │
       ├─ Write transaction completes (new nodes in Neo4j)
       │
       └─ CacheService.invalidatePattern("graph:*")
             Redis SCAN 0 MATCH "graph:*" COUNT 100
               → collect all matching keys
             Redis DEL key1 key2 ...
             // Forces next requests to re-query Neo4j
```
