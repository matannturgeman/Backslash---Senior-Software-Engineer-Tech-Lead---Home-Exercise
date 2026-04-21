# DI Refactor Plan

Implements the changes identified in `dependency-injection-audit.md`. Each step is atomic and independently testable.

---

## Step 1 — Create `ICacheService` interface and injection token

**New file:** `apps/api/src/app/cache/cache.interface.ts`

```typescript
export const CACHE_SERVICE = 'CACHE_SERVICE';

export interface ICacheService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  increment(key: string): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<void>;
  ping(): Promise<string>;
}
```

**Edit:** `apps/api/src/app/cache/cache.service.ts`
- Add `implements ICacheService`

**Edit:** `apps/api/src/app/cache/cache.module.ts`
```typescript
// Add alias provider so consumers can inject by token
providers: [
  CacheService,
  { provide: CACHE_SERVICE, useExisting: CacheService },
],
exports: [CacheService, CACHE_SERVICE],
```

---

## Step 2 — Update `CacheService` consumers to inject by token

**Files:** `graph.service.ts`, `graph.importer.ts`, `health.controller.ts`, `rate-limit.guard.ts`

Replace:
```typescript
constructor(private readonly cache: CacheService) {}
```

With:
```typescript
constructor(@Inject(CACHE_SERVICE) private readonly cache: ICacheService) {}
```

The variable name `cache` is acceptable here since it describes role, not implementation.

---

## Step 3 — Create `IGraphRepository` interface and injection token

**New file:** `apps/api/src/app/neo4j/graph-repository.interface.ts`

```typescript
export const GRAPH_REPOSITORY = 'GRAPH_REPOSITORY';

export interface IGraphRepository {
  runQuery<T = Record<string, unknown>>(
    cypher: string,
    params?: Record<string, unknown>
  ): Promise<T[]>;
  healthCheck(): Promise<boolean>;
}
```

**Edit:** `apps/api/src/app/neo4j/neo4j.service.ts`
- Add `implements IGraphRepository`
- Rename public methods to match the interface if needed

**Edit:** `apps/api/src/app/neo4j/neo4j.module.ts`
```typescript
providers: [
  { provide: NEO4J_DRIVER, useFactory: ..., inject: [ConfigService] },
  Neo4jService,
  { provide: GRAPH_REPOSITORY, useExisting: Neo4jService },
],
exports: [Neo4jService, GRAPH_REPOSITORY],
```

---

## Step 4 — Update `Neo4jService` consumers to inject by token

**Files:** `graph.service.ts`, `graph.importer.ts`, `health.controller.ts`

Replace:
```typescript
// graph.service.ts / graph.importer.ts
constructor(private readonly neo4j: Neo4jService) {}
```

With:
```typescript
constructor(
  @Inject(GRAPH_REPOSITORY) private readonly graphRepo: IGraphRepository,
) {}
```

Also rename all internal usages of `this.neo4j` → `this.graphRepo`.

**health.controller.ts:**
```typescript
constructor(
  @Inject(GRAPH_REPOSITORY) private readonly dbHealth: IGraphRepository,
  @Inject(CACHE_SERVICE) private readonly cache: ICacheService,
) {}
```

---

## Step 5 — Update unit tests

Each consumer test currently mocks the concrete class. After refactoring, mocks target the interface/token:

```typescript
// Before
providers: [{ provide: CacheService, useValue: mockCache }]

// After
providers: [{ provide: CACHE_SERVICE, useValue: mockCache }]
```

Same pattern for `GRAPH_REPOSITORY`.

---

## Validation Checklist

- [ ] `CacheService` implements `ICacheService`
- [ ] No file outside `cache/` imports `CacheService` as a type for injection
- [ ] `Neo4jService` implements `IGraphRepository`
- [ ] No file outside `neo4j/` imports `Neo4jService` as a type for injection
- [ ] `graph.service.ts` has no `neo4j` or `neo4j-driver` references in variable names
- [ ] `graph.importer.ts` has no `neo4j` or `neo4j-driver` references in variable names
- [ ] `health.controller.ts` has no direct `Neo4jService` or `CacheService` type references
- [ ] All existing unit tests pass after token-based mock updates
- [ ] E2E tests pass unchanged (they test behaviour, not wiring)

---

## Outcome

After these changes:

- **Swap Redis → Memcached**: Create `MemcachedCacheService implements ICacheService`, change one `provide` line in `cache.module.ts`. Zero changes to `GraphService`, `RateLimitGuard`, etc.
- **Swap Neo4j → Postgres**: Create `PostgresGraphRepository implements IGraphRepository`, change one `provide` line in a new module. Zero changes to `GraphService`, `GraphImporter`, etc.
- **Test any service in isolation**: Mock `CACHE_SERVICE` and `GRAPH_REPOSITORY` tokens — no need to instantiate real Redis or Neo4j drivers in unit tests.
