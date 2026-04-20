# `@libs/shared-dto`

Data Transfer Objects (DTOs) for the entire system — used by both server and client.

---

## Overview

This library defines **typed DTO objects backed by Zod schemas** from `@libs/shared-validation-schemas`. It is the single source of truth for the shape of data that crosses the API boundary (request bodies, response payloads, query parameters).

The key principle: **schemas first, types second**. Every DTO type is inferred from a Zod schema rather than written by hand, so validation logic and TypeScript types can never diverge.

---

## Location

```
libs/shared/dto/
├── src/
│   ├── lib/
│   │   └── dto.ts        – All DTO schemas, inferred types, and parse helpers
│   └── index.ts          – Public barrel export
├── project.json
├── package.json
└── ...config files
```

---

## Import Alias

```typescript
import { ... } from '@libs/shared-dto';
```

---

## Exports

### User DTOs

| Symbol | Kind | Description |
|--------|------|-------------|
| `CreateUserDtoSchema` | Zod schema | Validates the body of a create-user request |
| `UpdateUserDtoSchema` | Zod schema | Validates a partial update-user request body |
| `UserResponseDtoSchema` | Zod schema | Validates the shape of a user in API responses |
| `CreateUserDto` | Type | Inferred from `CreateUserDtoSchema` |
| `UpdateUserDto` | Type | Inferred from `UpdateUserDtoSchema` |
| `UserResponseDto` | Type | Inferred from `UserResponseDtoSchema` |

### Auth DTOs

| Symbol | Kind | Description |
|--------|------|-------------|
| `LoginDtoSchema` | Zod schema | Validates a login request body |
| `RegisterDtoSchema` | Zod schema | Validates a register request body |
| `AuthResponseDtoSchema` | Zod schema | Validates the shape of an auth response (tokens) |
| `LoginDto` | Type | Inferred from `LoginDtoSchema` |
| `RegisterDto` | Type | Inferred from `RegisterDtoSchema` |
| `AuthResponseDto` | Type | Inferred from `AuthResponseDtoSchema` |

### Pagination DTOs

| Symbol | Kind | Description |
|--------|------|-------------|
| `PaginationQueryDtoSchema` | Zod schema | Validates `?page=` and `?limit=` query parameters |
| `PaginatedResponseDtoSchema` | Zod schema factory | Generic paginated response schema for any item type |
| `PaginationQueryDto` | Type | Inferred from `PaginationQueryDtoSchema` |
| `PaginatedResponseDto<T>` | Generic type | Shape of a paginated API response |

### Helpers

| Symbol | Kind | Description |
|--------|------|-------------|
| `parseDto` | Function | Parse + validate input against a schema — throws `ZodError` on failure |
| `safeParseDto` | Function | Safe parse — never throws, returns a `SafeParseReturnType` |

---

## Usage

### Server side (NestJS)

#### Validating a request body

```typescript
// apps/api/src/users/users.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { parseDto, CreateUserDto, CreateUserDtoSchema } from '@libs/shared-dto';

@Controller('users')
export class UsersController {
  @Post()
  create(@Body() body: unknown) {
    // Throws ZodError (mapped to 400 by AllExceptionsFilter) on invalid input
    const dto: CreateUserDto = parseDto(CreateUserDtoSchema, body);
    return this.usersService.create(dto);
  }
}
```

#### Using with NestJS class-validator (alternative)

If you prefer `class-validator` pipes, import the DTO types here for consistent typing — the schema-driven types and class-validator decorators can coexist.

---

### Client side (React)

#### Typing a form submission

```typescript
// apps/client/src/features/auth/LoginForm.tsx
import { useState } from 'react';
import { getApiClient } from '@libs/client-server-communication';
import { safeParseDto, LoginDtoSchema } from '@libs/shared-dto';
import type { LoginDto, AuthResponseDto } from '@libs/shared-dto';

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(raw: unknown) {
    // Validate on the client before sending the request
    const result = safeParseDto(LoginDtoSchema, raw);

    if (!result.success) {
      setError(result.error.issues.map((i) => i.message).join(', '));
      return;
    }

    const dto: LoginDto = result.data;
    const response = await getApiClient().post<AuthResponseDto>('/auth/login', dto);
    // handle response...
  }

  // ...
}
```

---

### Using the pagination DTOs

```typescript
import {
  PaginationQueryDtoSchema,
  PaginatedResponseDtoSchema,
  parseDto,
} from '@libs/shared-dto';
import { userSchema } from '@libs/shared-validation-schemas';

// Validate query params
const query = parseDto(PaginationQueryDtoSchema, { page: '2', limit: '20' });
// → { page: 2, limit: 20 }

// Create a typed paginated response schema for users
const PaginatedUsersSchema = PaginatedResponseDtoSchema(userSchema);
```

---

### `parseDto` vs `safeParseDto`

```typescript
import { parseDto, safeParseDto, LoginDtoSchema } from '@libs/shared-dto';

// parseDto — throws ZodError on invalid input (good for server-side NestJS pipes)
const dto = parseDto(LoginDtoSchema, requestBody);

// safeParseDto — never throws (good for client-side form validation)
const result = safeParseDto(LoginDtoSchema, formData);
if (result.success) {
  // result.data is LoginDto
} else {
  // result.error is ZodError
  const messages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
}
```

---

## How DTOs relate to schemas and types

```
libs/shared/validation-schemas    ← defines Zod schemas (source of truth)
        │
        ▼
libs/shared/dto                   ← re-exports schemas as DTO schemas, infers DTO types
        │
        ▼
libs/shared/types                 ← infers higher-level types (User, AuthResponse, …)
                                     used throughout the stack beyond just the API boundary
```

The three libraries sit on the same layer of the dependency graph. They may
import from `@libs/shared-validation-schemas`, but must not import from each
other to avoid circular dependencies.

---

## Adding a New DTO Domain

1. Add the Zod schemas to `@libs/shared-validation-schemas` (e.g. `productSchema`, `createProductSchema`).
2. Open `libs/shared/dto/src/lib/dto.ts` and add:

```typescript
import { productSchema, createProductSchema } from '@libs/shared-validation-schemas';
import { z } from 'zod';

export const CreateProductDtoSchema = createProductSchema;
export const ProductResponseDtoSchema = productSchema;

export type CreateProductDto = z.infer<typeof CreateProductDtoSchema>;
export type ProductResponseDto = z.infer<typeof ProductResponseDtoSchema>;
```

3. The types are automatically available via `@libs/shared-dto` for both server and client consumers.

---

## Dependency Rules

```
@libs/shared-dto  →  @libs/shared-validation-schemas   ✅ allowed
@libs/shared-dto  →  @libs/shared-shared                ✅ allowed
@libs/shared-dto  →  @libs/server-*                     ✗ forbidden
@libs/shared-dto  →  @libs/client-*                     ✗ forbidden
```

---

## Nx Project Info

| Field | Value |
|-------|-------|
| Nx project name | `shared-dto` |
| Import alias | `@libs/shared-dto` |
| Tags | `scope:shared`, `type:dto` |
| Build executor | `@nx/js:tsc` |
| Output | `dist/libs/shared-dto` |

---

## Running Tasks

```bash
pnpm nx build shared-dto
pnpm nx test  shared-dto
pnpm nx lint  shared-dto
```

---

## Related Libraries

| Library | Relationship |
|---------|-------------|
| `@libs/shared-validation-schemas` | Source schemas — every DTO schema is derived from here |
| `@libs/shared-types` | Higher-level types inferred from the same base schemas |
| `@libs/shared-shared` | Common utilities (`parseDto` delegates to Zod's `.parse()` / `.safeParse()`) |
| `@libs/server-data-access` | Services accept DTO types as method parameters |
| `@libs/client-server-communication` | API calls use DTO types as generic parameters for request/response bodies |