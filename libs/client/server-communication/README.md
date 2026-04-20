# `@libs/client-server-communication`

Client-side library for all communication with the server. Currently supports REST via Axios, with the architecture ready for WebSocket and tRPC additions.

---

## Location

```
libs/client/server-communication/
├── src/
│   ├── lib/
│   │   ├── api-client.ts    – Axios factory, ApiError class, typed request helpers
│   │   └── rest.client.ts   – RestClient class + configureApiClient singleton
│   └── index.ts             – Public barrel export
├── project.json
├── package.json
└── ...config files
```

---

## Import Alias

```typescript
import { ... } from '@libs/client-server-communication';
```

---

## Setup

### 1. Install peer dependencies

`axios` is already present in the root `package.json`. No additional installs needed.

### 2. Configure the client once at app startup

Call `configureApiClient()` before any component mounts — typically in `src/main.tsx`:

```typescript
// apps/client/src/main.tsx
import { configureApiClient } from '@libs/client-server-communication';
import { store } from '@libs/client-store';
import { clearCredentials } from '@libs/client-store';

configureApiClient({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api',
  getToken: () => store.getState().auth.token,
  onUnauthorized: () => store.dispatch(clearCredentials()),
});
```

### 3. Use `getApiClient()` in any service or hook

```typescript
import { getApiClient } from '@libs/client-server-communication';

const client = getApiClient();
const users = await client.get<User[]>('/users');
```

---

## API Reference

### `configureApiClient(config: RestClientConfig): void`

Configures the application-wide `RestClient` singleton. Call this once at startup.

```typescript
interface RestClientConfig {
  /** Base URL for all requests, e.g. "http://localhost:3000/api" */
  baseURL: string;
  /** Request timeout in milliseconds. Defaults to 10 000. */
  timeoutMs?: number;
  /**
   * Factory that returns the current JWT bearer token.
   * Called before every request so the token is always fresh.
   */
  getToken?: () => string | null | undefined;
}
```

---

### `getApiClient(): RestClient`

Returns the configured `RestClient` singleton. Throws if `configureApiClient()` has not been called.

```typescript
const client = getApiClient();
```

---

### `createRestClient(config: RestClientConfig): RestClient`

Creates a new independent `RestClient` instance. Use this if you need multiple clients pointing at different base URLs (e.g. a third-party API alongside your own).

```typescript
const thirdPartyClient = createRestClient({
  baseURL: 'https://api.third-party.com',
  timeoutMs: 5_000,
});
```

---

### `RestClient` — method reference

All methods return the unwrapped response body (`T`) directly — no `.data` destructuring needed.

| Method | Signature | Description |
|--------|-----------|-------------|
| `get` | `get<T>(url, options?)` | HTTP GET |
| `post` | `post<T>(url, body?, options?)` | HTTP POST |
| `put` | `put<T>(url, body?, options?)` | HTTP PUT |
| `patch` | `patch<T>(url, body?, options?)` | HTTP PATCH |
| `delete` | `delete<T>(url, options?)` | HTTP DELETE |
| `axiosInstance` | getter | Raw Axios instance for advanced use cases |

#### Examples

```typescript
import { getApiClient } from '@libs/client-server-communication';
import type { UserResponseDto, CreateUserDto, UpdateUserDto } from '@libs/shared-dto';

const api = getApiClient();

// GET
const user = await api.get<UserResponseDto>('/users/1');

// POST
const created = await api.post<UserResponseDto>('/users', {
  email: 'alice@example.com',
  name: 'Alice',
  password: 'secret123',
} satisfies CreateUserDto);

// PATCH
const updated = await api.patch<UserResponseDto>('/users/1', {
  name: 'Alice Smith',
} satisfies UpdateUserDto);

// DELETE
await api.delete('/users/1');
```

---

### `ApiError`

Thrown by the response interceptor for any non-2xx response.

```typescript
import { getApiClient, ApiError } from '@libs/client-server-communication';

try {
  const user = await getApiClient().get<UserResponseDto>('/users/99');
} catch (err) {
  if (err instanceof ApiError) {
    console.error(`HTTP ${err.status}: ${err.message}`);

    if (err.status === 404) {
      // handle not found
    }
    if (err.status === 0) {
      // network error / timeout
    }
  }
}
```

| Property | Type | Description |
|----------|------|-------------|
| `message` | `string` | Human-readable error message from the server or Axios |
| `status` | `number` | HTTP status code (`0` = network error / timeout) |
| `cause` | `unknown` | The original Axios error for advanced introspection |

---

### `createApiClient(config?)` and standalone helpers

An alternative lower-level factory that returns a raw Axios instance with the same interceptors.
Comes with typed helper functions that unwrap `.data` automatically:

```typescript
import { createApiClient, get, post } from '@libs/client-server-communication';

const http = createApiClient({
  baseURL: 'http://localhost:3000/api',
  getToken: () => localStorage.getItem('token'),
});

const users = await get<UserResponseDto[]>(http, '/users');
const newUser = await post<CreateUserDto, UserResponseDto>(http, '/users', dto);
```

Available helpers: `get`, `post`, `put`, `patch`, `del`.

---

## Authorization

The `getToken` callback is called automatically before every request. The token is injected as:

```
Authorization: Bearer <token>
```

To skip auth on a specific request, pass `{ skipAuth: true }` as options:

```typescript
// Public endpoint — no Authorization header will be sent
const data = await api.get('/public/health', { skipAuth: true });
```

---

## Handling 401 Unauthorized

Use the `onUnauthorized` callback to clear credentials and redirect to login when the server returns a 401:

```typescript
configureApiClient({
  baseURL: import.meta.env.VITE_API_URL,
  getToken: () => store.getState().auth.token,
  onUnauthorized: () => {
    store.dispatch(clearCredentials());
    window.location.replace('/login');
  },
});
```

---

## Usage in a React hook

```typescript
// Example: useUsers.ts
import { useState, useEffect } from 'react';
import { getApiClient, ApiError } from '@libs/client-server-communication';
import type { UserResponseDto } from '@libs/shared-dto';

export function useUsers() {
  const [users, setUsers] = useState<UserResponseDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getApiClient()
      .get<UserResponseDto[]>('/users')
      .then((data) => { if (!cancelled) setUsers(data); })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Unknown error');
        }
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, []);

  return { users, error, isLoading };
}
```

---

## Extending for WebSocket / tRPC

This library is scoped to `libs/client/server-communication/` intentionally so WebSocket and tRPC transports can be added alongside REST without touching other libs.

### Suggested additions

```
src/lib/
├── api-client.ts          ← REST (Axios factory) — existing
├── rest.client.ts         ← REST (RestClient class) — existing
├── ws.client.ts           ← WebSocket client (add when needed)
└── trpc.client.ts         ← tRPC client (add when needed)
```

Each transport exports from `src/index.ts` under a named export so consumers can tree-shake:

```typescript
// future
export * from './lib/ws.client';
export * from './lib/trpc.client';
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Base URL used by the default Axios instance |
| `API_BASE_URL` | Fallback for non-Vite environments |

If neither is set, the client defaults to `http://localhost:3000/api`.

---

## Nx Project Info

| Field | Value |
|-------|-------|
| Nx project name | `client-server-communication` |
| Tags | `scope:client`, `type:data-access` |
| Build executor | `@nx/js:tsc` |
| Output | `dist/libs/client-server-communication` |

---

## Running Tasks

```bash
pnpm nx build client-server-communication
pnpm nx test  client-server-communication
pnpm nx lint  client-server-communication
```

---

## Related Libraries

| Library | Relationship |
|---------|-------------|
| `@libs/client-store` | Provides `store.getState().auth.token` for `getToken` and `clearCredentials` for `onUnauthorized` |
| `@libs/client-loggedin-user` | Consumes this lib to call `/auth/me` inside `resolveUser` |
| `@libs/shared-dto` | Provides typed request/response bodies (`LoginDto`, `UserResponseDto`, etc.) |
| `@libs/shared-types` | Provides shared TypeScript types used as generic parameters |