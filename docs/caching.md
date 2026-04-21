# Caching

## Overview

The application uses a **cache-aside** (lazy-load) pattern with Redis. The cache is entirely optional — if Redis is unavailable, all requests fall through to Neo4j transparently.

---

## Cache Keys

| Key | Set by | Invalidated by |
|---|---|---|
| `graph:full` | `GET /api/graph` on miss | Re-seed (pattern `graph:*`) |
| `graph:filtered:<names>` | `GET /api/graph/routes` on miss | Re-seed (pattern `graph:*`) |

The filtered key uses **sorted** filter names so `?filters=sinkEnd,publicStart` and `?filters=publicStart,sinkEnd` hit the same cache entry:

```ts
const cacheKey = `graph:filtered:${[...filterNames].sort().join(',')}`;
// → "graph:filtered:publicStart,sinkEnd"
```

---

## Cache-Aside Flow

```
Request arrives
     │
     ▼
CacheService.get(key)
     │
     ├─ available=false  →  return null  (bypass, no error)
     │
     ├─ Redis GET key
     │     HIT  →  JSON.parse(value)  →  return to caller  ──► skip Neo4j
     │     MISS ↓
     │
Neo4jService.run(query)
     │
     ▼
CacheService.set(key, value, TTL)
     │
     ├─ available=false  →  return void  (bypass, no error)
     └─ Redis SET key <json> EX <ttl>
```

---

## Graceful Degradation

`CacheService` tracks an `available` boolean:

```
constructor:
  client.on('connect') → available = true
  client.on('error')   → available = false

get / set / del / invalidatePattern:
  if (!available) return early (null / void)
```

This means:
- **Before Redis handshake completes** — cache is bypassed, not errored. No race condition where a partial connection causes null results.
- **If Redis goes down mid-operation** — the error event sets `available=false`. Subsequent requests bypass the cache silently.
- **If Redis recovers** — the `connect` event sets `available=true` again. Caching resumes automatically.

All cache errors are caught and logged as warnings — they never propagate to the API response.

---

## TTL

Default: **300 seconds** (5 minutes). Configurable via `CACHE_TTL` env var.

The same TTL applies to all cache entries. Since the graph data is static (changes only when `train-ticket.json` is updated), a longer TTL (e.g. 3600s) is safe in production.

---

## Invalidation

Cache is invalidated on graph re-seed using a SCAN-based pattern delete:

```ts
async invalidatePattern(pattern: string): Promise<void> {
  let cursor = '0';
  do {
    const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length > 0) await client.del(...keys);
  } while (cursor !== '0');
}
```

Called with pattern `graph:*` — matches both `graph:full` and all `graph:filtered:*` keys.

`SCAN` is used instead of `KEYS` because `KEYS` blocks the Redis event loop for large keyspaces. `SCAN` is non-blocking and iterates in batches of 100.

---

## Redis Client Configuration

```ts
new Redis({
  host: config.get('REDIS_HOST', 'localhost'),
  port: config.get('REDIS_PORT', 6379),
  lazyConnect: true,   // don't connect until .connect() is called
});

// connect() is called immediately but errors are swallowed via .catch(() => {})
// Errors surface through the 'error' event instead
this.client.connect().catch(() => undefined);
```

`lazyConnect: true` + manual `.connect()` allows the `'error'` event handler to be registered before the connection attempt, preventing unhandled promise rejections.

---

## Health Check

`CacheService.ping()` is used by `HealthController`:

```ts
async ping(): Promise<boolean> {
  if (!this.available) return false;
  try {
    await this.client.ping();
    return true;
  } catch {
    this.available = false;
    return false;
  }
}
```

Redis being down returns `{ redis: { status: "down" } }` in the health response but does **not** cause a 503 — Redis is optional infrastructure.

---

## Lifecycle

`CacheService` implements `OnModuleDestroy`:

```ts
async onModuleDestroy() {
  await this.client.quit();
}
```

On graceful shutdown, the Redis connection is closed cleanly before the process exits.
