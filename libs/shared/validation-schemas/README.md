# `@libs/shared-validation-schemas`

Zod validation schemas organised by domain. Used on **both the server (NestJS) and the client (React)** — the single source of truth for input validation across the entire stack.

---

## Location

```
libs/shared/validation-schemas/
├── src/
│   ├── lib/
│   │   └── validation-schemas.ts   – All schemas, organised by domain
│   └── index.ts                    – Public barrel export
├── project.json
├── package.json
├── tsconfig.json / tsconfig.lib.json / tsconfig.spec.json
├── jest.config.cts
└── eslint.config.mjs
```

---

## Import Alias

```typescript
import { loginSchema, userSchema, AuthSchemas } from '@libs/shared-validation-schemas';
```

---

## Purpose

- Define **all** Zod schemas once — never duplicate validation logic between frontend forms and backend controllers.
- Provide the raw schemas so `@libs/shared-types` and `@libs/shared-dto` can derive TypeScript types and DTO classes from them via `z.infer<>`.
- Keep schemas **pure** — no NestJS decorators, no React imports. Must run in any JS environment.

---

## Exports

### User Schemas

| Export | Description |
|--------|-------------|
| `userSchema` | Full user object (`id?`, `email`, `name`, `createdAt?`) |
| `createUserSchema` | Input for creating a user (`email`, `name`, `password`) |
| `updateUserSchema` | Partial version of `createUserSchema` |
| `UserSchemas` | Namespace: `{ user, create, update }` |

```typescript
import { userSchema, createUserSchema, UserSchemas } from '@libs/shared-validation-schemas';

// Validate a full user object
const user = userSchema.parse(raw);

// Validate create-user input
const input = createUserSchema.parse(req.body);

// Via namespace
const input = UserSchemas.create.parse(req.body);
```

---

### Auth Schemas

| Export | Description |
|--------|-------------|
| `loginSchema` | `{ email, password }` |
| `registerSchema` | `{ email, password, name, phone? }` |
| `authResponseSchema` | `{ accessToken, refreshToken?, tokenType, expiresIn }` |
| `refreshTokenSchema` | `{ refreshToken }` |
| `AuthSchemas` | Namespace: `{ login, register, response, refresh }` |

```typescript
import { loginSchema, AuthSchemas } from '@libs/shared-validation-schemas';

// Server — validate request body in a NestJS pipe
const dto = loginSchema.parse(body);

// Client — validate a login form before submitting
const result = AuthSchemas.login.safeParse(formValues);
if (!result.success) {
  showErrors(result.error.flatten().fieldErrors);
}
```

---

### Common / Pagination Schemas

| Export | Description |
|--------|-------------|
| `paginationQuerySchema` | `{ page, limit }` with coercion and defaults |
| `errorResponseSchema` | `{ statusCode, message, error? }` |
| `CommonSchemas` | Namespace: `{ paginationQuery, errorResponse }` |

```typescript
import { paginationQuerySchema } from '@libs/shared-validation-schemas';

// Parse query params — coerces strings to numbers
const { page, limit } = paginationQuerySchema.parse(req.query);
// page defaults to 1, limit defaults to 10
```

---

## Using Schemas for Type Inference

These schemas are the foundation of `@libs/shared-types` and `@libs/shared-dto`. You generally **do not** need to call `z.infer<>` yourself — import the ready-made types from those libraries instead:

```typescript
// ✅ Preferred — import the inferred type
import type { User, LoginInput } from '@libs/shared-types';

// ⚠️ Only if you need a type that isn't exposed by @libs/shared-types yet
import { z } from 'zod';
import { userSchema } from '@libs/shared-validation-schemas';
type User = z.infer<typeof userSchema>;
```

---

## Adding a New Schema

1. Open `libs/shared/validation-schemas/src/lib/validation-schemas.ts`.
2. Add your schema in the appropriate domain section (or create a new section).
3. Export it and add it to the relevant namespace object.
4. If it produces a new type, expose it in `@libs/shared-types`.
5. If it backs a DTO, expose the DTO in `@libs/shared-dto`.

### Example — adding a `Product` schema

```typescript
// In validation-schemas.ts

// ---------------------------------------------------------------------------
// Product schemas
// ---------------------------------------------------------------------------

export const productSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  price: z.number().positive(),
  createdAt: z.date().optional(),
});

export const createProductSchema = productSchema.omit({ id: true, createdAt: true });
export const updateProductSchema = createProductSchema.partial();

export const ProductSchemas = {
  product: productSchema,
  create: createProductSchema,
  update: updateProductSchema,
} as const;
```

---

## Validation Rules Reference

| Field | Rule | Schema |
|-------|------|--------|
| `email` | Valid email format | All auth + user schemas |
| `password` | Min 8, max 100 characters | `createUserSchema`, `loginSchema`, `registerSchema` |
| `name` | Min 2, max 50 characters | `userSchema`, `createUserSchema`, `registerSchema` |
| `phone` | Optional string | `registerSchema` |
| `page` | Integer ≥ 1, default 1 | `paginationQuerySchema` |
| `limit` | Integer 1–100, default 10 | `paginationQuerySchema` |
| `tokenType` | Enum `'Bearer'` | `authResponseSchema` |

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `zod` | Schema definition and validation |

No NestJS, React, or browser APIs are used — this library is fully isomorphic.

---

## Nx Project Info

| Field | Value |
|-------|-------|
| Nx project name | `shared-validation-schemas` |
| Import alias | `@libs/shared-validation-schemas` |
| Tags | `scope:shared`, `type:validation` |
| Build executor | `@nx/js:tsc` |
| Output | `dist/libs/shared-validation-schemas` |

---

## Running Tasks

```bash
pnpm nx build shared-validation-schemas
pnpm nx test  shared-validation-schemas
pnpm nx lint  shared-validation-schemas
```

---

## Related Libraries

| Library | Relationship |
|---------|-------------|
| `@libs/shared-types` | Derives TypeScript types from schemas via `z.infer<>` |
| `@libs/shared-dto` | Re-exports schemas as DTO schemas and provides `parseDto()` helpers |
| `@libs/shared-shared` | Provides utility types (`PaginatedResult`, `HttpResponse`) used alongside schema outputs |