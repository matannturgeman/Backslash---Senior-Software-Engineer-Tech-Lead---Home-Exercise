# Dependency Injection Audit

## Summary

This document audits all dependency injection patterns across the codebase and identifies violations of the Dependency Inversion Principle (DIP). The core problem: **business logic depends on concrete infrastructure classes instead of abstractions**, meaning swapping Redis → Memcached, or Neo4j → MongoDB/Postgres, requires touching every consumer.

---

## Current State

### What is done correctly

| Location | Pattern | Why it's good |
|---|---|---|
| `neo4j/neo4j.module.ts` | `{ provide: NEO4J_DRIVER, useFactory: ... }` | Driver injected via custom token, not concrete import |
| `neo4j/neo4j.service.ts` | `@Inject(NEO4J_DRIVER) driver: Driver` | Depends on token, not `neo4j-driver` class |
| All modules | `ConfigService` | NestJS abstract config, not `process.env` directly |
| `neo4j/neo4j.module.ts` | `useFactory` pattern | Config injected, not hardcoded |

### Violations

#### 1. `CacheService` — Redis hardcoded in constructor

**File:** `apps/api/src/app/cache/cache.service.ts`

```typescript
// PROBLEM: Redis client instantiated directly inside the service
constructor(private readonly config: ConfigService) {
  this.client = new Redis({ host: ..., port: ... }); // concrete instantiation
}
```

No `ICacheService` interface exists. Every consumer is forced to depend on the Redis-backed implementation.

---

#### 2. `GraphService` — depends on concrete `Neo4jService` and `CacheService`

**File:** `apps/api/src/app/graph/graph.service.ts`

```typescript
// PROBLEM: concrete class names in constructor
constructor(
  private readonly neo4j: Neo4jService,   // should be IGraphRepository
  private readonly cache: CacheService,   // should be ICacheService
  private readonly config: ConfigService,
) {}
```

If Neo4j is replaced with Postgres, `GraphService` must be rewritten even though its business logic has not changed.

---

#### 3. `GraphImporter` — same violations

**File:** `apps/api/src/app/graph/graph.importer.ts`

```typescript
// PROBLEM: concrete class names in constructor
constructor(
  private readonly loader: GraphLoader,
  private readonly neo4j: Neo4jService,   // should be IGraphRepository
  private readonly cache: CacheService,   // should be ICacheService
) {}
```

---

#### 4. `HealthController` — infrastructure services leaked into controller layer

**File:** `apps/api/src/app/health/health.controller.ts`

```typescript
// PROBLEM: controller directly depends on infrastructure details
constructor(
  private readonly neo4j: Neo4jService,   // should be IHealthCheckable or abstraction
  private readonly cache: CacheService,   // should be ICacheService
) {}
```

Controllers should never know about Neo4j or Redis specifically.

---

#### 5. `RateLimitGuard` — concrete `CacheService`

**File:** `apps/api/src/app/rate-limit/rate-limit.guard.ts`

```typescript
// PROBLEM: guard locked to Redis-backed cache
constructor(
  private readonly cache: CacheService,   // should be ICacheService
  config: ConfigService,
) {}
```

Rate limiting logic (increment counter, check TTL) is generic — it should work with any key-value store.

---


## Variable/Parameter Naming Violations

Beyond types, **variable names** also leak infrastructure details into business logic:

| File | Variable | Problem | Should be |
|---|---|---|---|
| `graph.service.ts` | `this.neo4j` | Neo4j-specific name in business logic | `this.graphRepo` or `this.db` |
| `graph.importer.ts` | `this.neo4j` | Same | `this.graphRepo` |
| `health.controller.ts` | `this.neo4j` | Infrastructure detail in controller | `this.dbHealth` |
| `health.controller.ts` | `this.cache` | Acceptable but use token | `this.cache` via `ICacheService` |
| `rate-limit.guard.ts` | `this.cache` | Acceptable but use token | `this.cache` via `ICacheService` |

Even if the type is an interface, naming it `neo4j` signals the implementation and makes code harder to reason about when the database changes.

---

## Missing Abstractions

These interfaces/tokens do not exist yet and must be created:

### `ICacheService`
```typescript
export interface ICacheService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  increment(key: string): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<void>;
  ping(): Promise<string>;
}

export const CACHE_SERVICE = 'CACHE_SERVICE';
```

Used by: `GraphService`, `GraphImporter`, `HealthController`, `RateLimitGuard`

### `IGraphRepository`
```typescript
export interface IGraphRepository {
  runQuery<T = Record<string, unknown>>(
    cypher: string,
    params?: Record<string, unknown>
  ): Promise<T[]>;
  healthCheck(): Promise<boolean>;
}

export const GRAPH_REPOSITORY = 'GRAPH_REPOSITORY';
```

Used by: `GraphService`, `GraphImporter`, `HealthController`

---

## Impact Matrix

| Change | Files affected | Risk | Priority |
|---|---|---|---|
| Add `ICacheService` + `CACHE_SERVICE` token | `cache.service.ts`, `cache.module.ts` | Low | High |
| Inject `ICacheService` in consumers | `graph.service.ts`, `graph.importer.ts`, `health.controller.ts`, `rate-limit.guard.ts` | Low | High |
| Add `IGraphRepository` + `GRAPH_REPOSITORY` token | `neo4j.service.ts`, `neo4j.module.ts` | Low | High |
| Inject `IGraphRepository` in consumers | `graph.service.ts`, `graph.importer.ts`, `health.controller.ts` | Medium | High |
| Rename `neo4j` variables to `graphRepo`/`db` | `graph.service.ts`, `graph.importer.ts`, `health.controller.ts` | Low | Medium |

---

## What Does NOT Need to Change

- `Neo4jService` internal implementation — it correctly uses `@Inject(NEO4J_DRIVER)`
- `Neo4jModule` factory provider — already the correct pattern
- `GraphLoader` — stateless file loader, no infrastructure coupling
- `ConfigService` usage — NestJS abstract, already correct
- `neo4j.constants.ts` `NEO4J_DRIVER` token — already correct
