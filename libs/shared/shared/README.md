# `@libs/shared-shared`

Isomorphic utility library — safe to import from both `libs/server/*` and `libs/client/*`.

This is the **internal shared layer for the `libs/shared/` scope**. It holds cross-cutting helpers, type utilities, and response envelope functions that are needed by the other shared libraries (`dto`, `types`, `validation-schemas`) and by both the server and client applications.

---

## Location

```
libs/shared/shared/
├── src/
│   ├── lib/
│   │   └── shared.ts   – All exports
│   └── index.ts        – Public barrel
├── project.json
├── package.json
└── ...config files
```

---

## Import Alias

```typescript
import { ... } from '@libs/shared-shared';
```

---

## Exports

### Pagination

```typescript
interface PaginationParams {
  page: number;
  limit: number;
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function paginate<T>(data: T[], total: number, params: PaginationParams): PaginatedResult<T>
```

**Usage:**

```typescript
import { paginate } from '@libs/shared-shared';

// Server side (NestJS service)
const items = await prisma.user.findMany({ skip, take });
const total = await prisma.user.count();

return paginate(items, total, { page: 1, limit: 20 });
// → { data: [...], total: 45, page: 1, limit: 20, totalPages: 3 }
```

---

### HTTP Response Envelope

```typescript
interface HttpResponse<T = unknown> {
  statusCode: number;
  data?: T;
  message?: string;
  error?: string | null;
}

function successResponse<T>(data: T, statusCode?: number, message?: string): HttpResponse<T>
function errorResponse(error: string, statusCode?: number): HttpResponse<never>
```

**Usage:**

```typescript
import { successResponse, errorResponse } from '@libs/shared-shared';

// Successful response
return successResponse(user, 201, 'User created');
// → { statusCode: 201, data: { id: 1, ... }, message: 'User created' }

// Error response
return errorResponse('User not found', 404);
// → { statusCode: 404, error: 'User not found' }
```

---

### Status Code Type

```typescript
type StatusCode = 200 | 201 | 400 | 401 | 403 | 404 | 409 | 500;
```

---

### Utility Types

```typescript
/** Make specific keys of T required */
type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/** Make specific keys of T optional */
type PartialFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** Strip null and undefined from all fields */
type NonNullableFields<T> = { [K in keyof T]: NonNullable<T[K]> };
```

**Usage:**

```typescript
import type { RequireFields, PartialFields } from '@libs/shared-shared';

// User from DB always has an id, but the input schema has it optional
type UserFromDb = RequireFields<User, 'id'>;

// DTO for updates — everything optional except email
type PatchUserDto = PartialFields<User, 'name'>;
```

---

### General Helpers

| Function | Signature | Description |
|----------|-----------|-------------|
| `isDefined` | `<T>(value: T \| null \| undefined): value is T` | Narrows out `null` and `undefined` |
| `omitUndefined` | `<T>(obj: T): Partial<T>` | Removes keys whose value is `undefined` |
| `capitalize` | `(str: string): string` | Capitalises the first letter |
| `toSnakeCase` | `(str: string): string` | Converts `camelCase` to `snake_case` |
| `deepFreeze` | `<T extends object>(obj: T): Readonly<T>` | Recursively freezes an object |

**Usage:**

```typescript
import { isDefined, omitUndefined, capitalize, toSnakeCase, deepFreeze } from '@libs/shared-shared';

// isDefined — useful as an array filter predicate
const values = [1, null, 2, undefined, 3];
const defined = values.filter(isDefined); // [1, 2, 3]

// omitUndefined — clean up PATCH payloads before sending to the DB
const patch = omitUndefined({ name: 'Alice', email: undefined }); // { name: 'Alice' }

// capitalize
capitalize('hello world'); // 'Hello world'

// toSnakeCase
toSnakeCase('createdAt'); // 'created_at'

// deepFreeze — immutable constants
const CONFIG = deepFreeze({ api: { version: 'v1', timeout: 5000 } });
```

---

## What Belongs Here

| ✅ Add to `shared-shared` | ❌ Put elsewhere |
|--------------------------|-----------------|
| Framework-agnostic utility functions | NestJS decorators / guards → `@libs/server-shared` |
| Generic type helpers | React hooks → `@libs/client-shared` |
| HTTP response envelope types | Zod schemas → `@libs/shared-validation-schemas` |
| Pagination helpers | DTO types → `@libs/shared-dto` |
| String / object / array utilities safe in both environments | Domain types → `@libs/shared-types` |

---

## Dependency Rules

```
@libs/shared-shared  →  (no other workspace libs)  ✅ leaf node — no internal dependencies
@libs/shared-dto     →  @libs/shared-shared         ✅ allowed
@libs/shared-types   →  @libs/shared-shared         ✅ allowed
@libs/server-*       →  @libs/shared-shared         ✅ allowed
@libs/client-*       →  @libs/shared-shared         ✅ allowed
```

`shared-shared` is a **leaf node** in the dependency graph. It must not import from any other `@libs/*` package to avoid circular dependencies.

---

## Nx Project Info

| Field | Value |
|-------|-------|
| Nx project name | `shared-shared` |
| Import alias | `@libs/shared-shared` |
| Tags | `scope:shared`, `type:shared` |
| Build executor | `@nx/js:tsc` |
| Output | `dist/libs/shared-shared` |

---

## Running Tasks

```bash
pnpm nx build shared-shared
pnpm nx test  shared-shared
pnpm nx lint  shared-shared
```

---

## Related Libraries

| Library | Relationship |
|---------|-------------|
| `@libs/shared-validation-schemas` | May import utilities from this library |
| `@libs/shared-dto` | May import `paginate`, `HttpResponse`, and type helpers from this library |
| `@libs/shared-types` | May import type utilities from this library |
| `@libs/server-shared` | Server-specific layer — may import from this library |
| `@libs/client-shared` | Client-specific layer — may import from this library |