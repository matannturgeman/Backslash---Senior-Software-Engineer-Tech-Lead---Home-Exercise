# `@libs/server-data-access`

> Prisma client, database modules, and the global HTTP exception filter for the NestJS API.

---

## Location

```
libs/server/data-access/
├── src/
│   ├── lib/
│   │   ├── backend-data-access.module.ts  – NestJS module (re-exports Prisma + filter)
│   │   ├── prisma.module.ts               – Prisma client singleton (pg adapter)
│   │   ├── http-exception.filter.ts       – Global catch-all exception filter
│   │   └── index.ts                       – Internal barrel
│   └── index.ts                           – Public barrel
├── project.json
├── package.json
├── tsconfig.json / tsconfig.lib.json / tsconfig.spec.json
├── jest.config.cts
└── eslint.config.mjs
```

---

## Exports

| Symbol | Description |
|--------|-------------|
| `BackendDataAccessModule` | NestJS `@Module` that bundles the Prisma setup |
| `prisma` | Configured `PrismaClient` singleton (PostgreSQL via `@prisma/adapter-pg`) |
| `AllExceptionsFilter` | Global `ExceptionFilter` — maps any thrown exception to a JSON error response |

---

## Usage

### 1. Register in `AppModule`

```typescript
import { Module } from '@nestjs/common';
import { BackendDataAccessModule } from '@libs/server-data-access';

@Module({
  imports: [BackendDataAccessModule],
})
export class AppModule {}
```

### 2. Apply the global exception filter

The filter is already applied in `apps/api/src/main.ts`:

```typescript
import { AllExceptionsFilter } from '@libs/server-data-access';

app.useGlobalFilters(new AllExceptionsFilter());
```

### 3. Use the Prisma client directly

```typescript
import { prisma } from '@libs/server-data-access';

const users = await prisma.user.findMany();
```

> For service-layer usage, prefer injecting Prisma through a NestJS provider
> rather than importing the singleton directly. That makes unit testing easier.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | *(required)* | Full PostgreSQL connection string, e.g. `postgresql://user:pass@localhost:5432/nxdb` |

The Prisma client is initialised with `dotenv/config` loaded before the first
import, so variables from `.env` are available at startup.

---

## Error Response Format

`AllExceptionsFilter` returns a consistent JSON envelope for every unhandled error:

```json
{
  "statusCode": 500,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "message": "Internal server error"
}
```

`HttpException` subclasses (e.g. `NotFoundException`, `BadRequestException`)
will use their own status code rather than 500.

---

## Adding New Prisma Models

1. Update `prisma/schema.prisma` with the new model.
2. Run `pnpm prisma migrate dev --name <migration-name>` to create the migration.
3. Run `pnpm prisma generate` to regenerate the Prisma client types.
4. Use the updated `prisma` singleton or create a dedicated repository service.

---

## Dependencies

- `@prisma/client` — Prisma ORM client
- `@prisma/adapter-pg` — PostgreSQL adapter for the Prisma driver
- `pg` — Node.js PostgreSQL driver
- `dotenv` — Environment variable loader
- `@nestjs/common` — NestJS core decorators and utilities

---

## Related Libraries

| Library | Relationship |
|---------|-------------|
| `@libs/server-auth` | Imports `AllExceptionsFilter` indirectly via `AppModule` |
| `@libs/server-shared` | Shared server utilities (interceptors, pipes) |
| `@libs/shared-dto` | DTO types used in repository return values |