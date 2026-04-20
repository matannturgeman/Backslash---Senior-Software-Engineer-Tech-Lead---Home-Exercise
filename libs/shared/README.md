# Shared Libraries

This directory contains all shared logic and utilities that can be used by both server-side and client-side applications in the Nx workspace.

## Purpose

The `libs/shared` folder holds common code that is reusable across the entire system including:
- Validation schemas (Zod) for both client and server validation
- DTOs backed by Zod schemas for type-safe API contracts
- Shared TypeScript types and interfaces used throughout the system
- Common utility functions that work in both environments

## Structure

```
shared/
├── validation-schemas/       # Zod schemas for server and client validation
│   ├── index.ts             # Main entry point for all schemas
│   ├── user.schema.ts       # User-related schemas
│   ├── auth.schema.ts       # Authentication schemas
│   ├── product.schema.ts    # Product-related schemas
│   └── ...                  # Other domain schemas
│
├── dto/                     # DTO objects backed by Zod schemas
│   ├── index.ts             # Main entry point for all DTOs
│   ├── user.dto.ts          # User DTO with zod-backed types
│   ├── auth.dto.ts          # Auth DTO for login/register responses
│   ├── product.dto.ts       # Product-related DTOs
│   └── ...                  # Other DTOs
│
├── types/                   # Shared TypeScript types and interfaces
│   ├── index.ts             # Main entry point for all types
│   ├── user.types.ts        # User-related type definitions
│   ├── auth.types.ts        # Auth-related type definitions
│   ├── http.types.ts        # HTTP response/error types
│   └── ...                  # Other shared types
│
├── shared/                  # Shared logic between server and client libs
│   ├── index.ts             # Main entry point for all shared utilities
│   ├── formatters.ts        # Common formatters (date, currency, etc.)
│   ├── validators.ts        # Validation helpers
│   └── ...                  # Other shared utilities
│
└── package.json            # Library metadata and dependencies
```

## Usage Examples

### Validation Schemas

```typescript
// Import schema from validation-schemas
import { userSchema } from '@lib/shared-validation-schemas';

const userInput = { name: 'John', email: 'john@example.com' };
const result = userSchema.safeParse(userInput);

if (result.success) {
  console.log('Valid user:', result.data);
} else {
  console.error('Validation error:', result.error.errors);
}
```

### DTOs

```typescript
// Import DTO from shared-dto
import { UserDto, CreateUserRequestDto } from '@lib/shared-dto';

const user: UserDto = {
  id: 1,
  email: 'john@example.com',
  name: 'John Doe'
};

const createUserRequest: CreateUserRequestDto = {
  email: 'john@example.com',
  name: 'John Doe'
};

// DTOs are backed by Zod schemas for validation
console.log(user.email.includes('@')); // type-safe access
```

### Shared Types

```typescript
// Import types from shared-types
import { User, PaginatedResult, HttpResponse } from '@lib/shared-types';

function handleUser(data: User) {
  console.log(`User ${data.name} logged in`);
}

async function fetchUsers(offset: number): Promise<PaginatedResult<User[]>> {
  const users = await api.get('/users');
  return PaginatedResult.from(users);
}
```

### Shared Utilities

```typescript
// Import shared utilities from shared-shared
import { formatDate, formatCurrency } from '@lib/shared-shared';

const date = new Date();
console.log(formatDate(date)); // "2024-01-15T10:30:00Z"

const price = 99.99;
console.log(formatCurrency(price, 'USD')); // "$99.99"
```

## Zod Schema to DTO Pattern

The shared libraries follow this pattern:

1. **Define Zod Schema** in `validation-schemas/`
2. **Create DTO object** in `dto/` that mirrors the schema structure
3. **Export types** from `types/` for direct use without instantiation

```typescript
// 1. Validation schema (shared/validation-schemas/user.schema.ts)
import { z } from 'zod';

export const userSchema = z.object({
  id: z.number().optional(),
  email: z.string().email(),
  name: z.string().min(2).max(50),
  createdAt: z.date().optional(),
});

// 2. DTO (shared/dto/user.dto.ts)
import { userSchema } from '@lib/shared-validation-schemas';
import type { Static } from '@tsjs/types';

export const userDto = userSchema as unknown as {
  parse: typeof userSchema.parse;
  safeParse: typeof userSchema.safeParse;
};

// 3. Type exports (shared/types/user.types.ts)
import { userSchema } from '@lib/shared-validation-schemas';

export type User = Static<typeof userSchema>;
export type CreateUserDto = Omit<User, 'id'>;
```

## Available Libraries

- **@lib/shared-validation-schemas**: Zod schemas for both client and server validation
- **@lib/shared-dto**: TypeScript DTO objects backed by Zod schemas
- **@lib/shared-types**: Shared TypeScript types and interfaces (derived from schemas)
- **@lib/shared-shared**: Common utilities and helpers for shared use

## Best Practices

1. **Single Source of Truth**: Define schemas once in `validation-schemas/`, derive DTOs and types from them
2. **Type Safety**: Use Zod's built-in type inference to generate TypeScript types automatically
3. **Domain Organization**: Group schemas by domain (user, auth, product, etc.) for maintainability
4. **Validation First**: Always validate input using Zod schemas before processing
5. **Consistent Naming**: Follow consistent naming conventions across schemas, DTOs, and types
6. **Version Your Schemas**: When changing schema structure, create new versions instead of modifying existing ones

## Testing

Run tests for shared libraries:

```bash
nx test shared-validation-schemas
nx test shared-dto
nx test shared-types
nx test shared-shared
```

Build the shared libraries:

```bash
nx build shared-validation-schemas
nx build shared-dto
nx build shared-types
nx build shared-shared
```

## License

MIT