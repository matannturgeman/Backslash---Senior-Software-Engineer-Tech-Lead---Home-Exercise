# `@libs/shared-types`

TypeScript types and interfaces shared between the server and client — inferred directly from the Zod schemas in `@libs/shared-validation-schemas`.

---

## Location

```
libs/shared/types/
├── src/
│   ├── lib/
│   │   └── types.ts      – All shared types and interfaces
│   └── index.ts          – Public barrel export
├── project.json
├── package.json
├── tsconfig.json / tsconfig.lib.json / tsconfig.spec.json
├── jest.config.cts
└── eslint.config.mjs
```

---

## Import Alias

```typescript
import type { User, LoginInput, AuthResponse } from '@libs/shared-types';
```

---

## Philosophy

- Types here are **inferred from Zod schemas** wherever possible (`z.infer<typeof schema>`), keeping the type definitions and validation rules in sync automatically.
- Plain interfaces are used for types that do not have a corresponding Zod schema (pagination, HTTP envelopes, domain entities like `Order`).
- This library is **read-only** from the perspective of `libs/server/` and `libs/client/` — they import types from here but never define them here.

---

## Exports

### User types

```typescript
import type {
  User,
  CreateUserInput,
  UpdateUserInput,
} from '@libs/shared-types';
```

| Type | Description |
|------|-------------|
| `User` | Full user object as stored in the database (`id?`, `email`, `name`, `createdAt?`) |
| `CreateUserInput` | Input for creating a user (`email`, `name`, `password`) |
| `UpdateUserInput` | Partial update — only `name` is patchable via the API |

---

### Auth types

```typescript
import type {
  LoginInput,
  RegisterInput,
  AuthResponse,
} from '@libs/shared-types';
```

| Type | Description |
|------|-------------|
| `LoginInput` | `{ email: string; password: string }` |
| `RegisterInput` | `{ email, password, name, phone? }` |
| `AuthResponse` | `{ accessToken, refreshToken?, tokenType: 'Bearer', expiresIn }` |

---

### Pagination types

```typescript
import type { PaginatedResult, PaginationQuery } from '@libs/shared-types';

// Generic paginated list
const result: PaginatedResult<User> = {
  data: [...],
  total: 42,
  page: 1,
  limit: 10,
};
```

| Type | Description |
|------|-------------|
| `PaginationQuery` | `{ page?: number; limit?: number }` — query params for paginated endpoints |
| `PaginatedResult<T>` | Generic paginated response envelope |

---

### HTTP response types

```typescript
import type { ApiResponse, StatusCode } from '@libs/shared-types';

function wrapResponse<T>(data: T): ApiResponse<T> {
  return { statusCode: 200, data };
}
```

| Type | Description |
|------|-------------|
| `ApiResponse<T>` | Generic API response envelope `{ statusCode, data?, message?, error? }` |
| `StatusCode` | Union of common HTTP status codes: `200 \| 201 \| 400 \| 401 \| 403 \| 404 \| 409 \| 500` |

---

### Product types

```typescript
import type { Product, CreateProductInput, UpdateProductInput } from '@libs/shared-types';
```

| Type | Description |
|------|-------------|
| `Product` | `{ id, name, description, price, createdAt }` |
| `CreateProductInput` | `Omit<Product, 'id' \| 'createdAt'>` |
| `UpdateProductInput` | `Partial<CreateProductInput>` |

---

### Order types

```typescript
import type { Order, OrderItem, OrderStatus, CreateOrderInput } from '@libs/shared-types';
```

| Type | Description |
|------|-------------|
| `Order` | `{ id, userId, items, total, status, createdAt }` |
| `OrderItem` | `{ productId, quantity, unitPrice }` |
| `OrderStatus` | `'pending' \| 'confirmed' \| 'shipped' \| 'delivered' \| 'cancelled'` |
| `CreateOrderInput` | `Omit<Order, 'id' \| 'status' \| 'createdAt'>` |

---

## Usage Examples

### In a NestJS service

```typescript
import type { User, PaginatedResult } from '@libs/shared-types';

@Injectable()
export class UsersService {
  async findAll(page: number, limit: number): Promise<PaginatedResult<User>> {
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({ skip: (page - 1) * limit, take: limit }),
      this.prisma.user.count(),
    ]);
    return { data, total, page, limit };
  }
}
```

### In a React component

```typescript
import type { User } from '@libs/shared-types';

interface UserCardProps {
  user: User;
}

function UserCard({ user }: UserCardProps) {
  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
}
```

### Narrowing with `ApiResponse<T>`

```typescript
import type { ApiResponse, User } from '@libs/shared-types';

async function fetchUser(id: number): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  const body: ApiResponse<User> = await response.json();

  if (body.error) throw new Error(body.error);
  return body.data!;
}
```

---

## Adding New Types

1. Open `libs/shared/types/src/lib/types.ts`.
2. For types that have a Zod schema, use `z.infer<typeof schema>`:
   ```typescript
   import { myNewSchema } from '@libs/shared-validation-schemas';
   export type MyNewType = z.infer<typeof myNewSchema>;
   ```
3. For standalone interfaces (no Zod schema), define them directly:
   ```typescript
   export interface MyNewEntity {
     id: number;
     name: string;
   }
   ```
4. Re-export from `src/index.ts` (already done via `export * from './lib/types'`).

---

## Dependency Graph

```
@libs/shared-types
    └── @libs/shared-validation-schemas   (imports Zod schemas for type inference)
```

`@libs/shared-types` must **not** import from `@libs/server-*` or `@libs/client-*`.

---

## Nx Project Info

| Field | Value |
|-------|-------|
| Nx project name | `shared-types` |
| Import alias | `@libs/shared-types` |
| Tags | `scope:shared`, `type:types` |
| Build executor | `@nx/js:tsc` |
| Output | `dist/libs/shared-types` |

---

## Running Tasks

```bash
pnpm nx build shared-types
pnpm nx test  shared-types
pnpm nx lint  shared-types
```

---

## Related Libraries

| Library | Relationship |
|---------|-------------|
| `@libs/shared-validation-schemas` | Source of truth — types are inferred from these schemas |
| `@libs/shared-dto` | DTOs are derived from both validation schemas and these types |
| `@libs/shared-shared` | Utility types (`RequireFields`, `PartialFields`, etc.) used here |
| `@libs/server-user` | `LoggedInUser` mirrors the `User` type from this library |
| `@libs/client-loggedin-user` | Client-side `LoggedInUser` mirrors `User` from this library |