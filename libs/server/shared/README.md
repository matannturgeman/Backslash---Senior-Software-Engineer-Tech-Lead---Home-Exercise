# `@libs/server-shared`

Server-side utilities shared between all `libs/server/*` libraries.

This library is the **internal shared layer for the server scope** — it holds cross-cutting NestJS helpers, interceptors, pipes, decorators, and utilities that are too generic to belong to a specific domain library (`auth`, `user`, `data-access`) but still server-only in nature.

---

## Location

```
libs/server/shared/
```

## Import Alias

```typescript
import { ... } from '@libs/server-shared';
```

---

## Purpose

| What belongs here | What does NOT belong here |
|-------------------|--------------------------|
| NestJS interceptors (logging, transform) | Business logic |
| Generic NestJS pipes (validation, parse) | Auth logic → use `@libs/server-auth` |
| Shared NestJS decorators | User resolution → use `@libs/server-user` |
| Error handling helpers | Database access → use `@libs/server-data-access` |
| Utility functions used by ≥2 server libs | Anything safe to use in the browser → use `@libs/shared-shared` |

---

## Current Exports

### `sharedUtils()`

A placeholder utility exported from `src/lib/shared-utils.ts`. Replace with real shared logic as the project grows.

```typescript
import { sharedUtils } from '@libs/server-shared';

const result = sharedUtils(); // 'shared-utils'
```

---

## Suggested Additions

As the server grows, add the following to this library:

### Logging Interceptor

```typescript
// src/lib/logging.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ method: string; url: string }>();
    const { method, url } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.logger.log(`${method} ${url} — ${Date.now() - start}ms`);
      }),
    );
  }
}
```

### Response Transform Interceptor

```typescript
// src/lib/transform.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface WrappedResponse<T> {
  statusCode: number;
  data: T;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, WrappedResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<WrappedResponse<T>> {
    const statusCode: number =
      context.switchToHttp().getResponse<{ statusCode: number }>().statusCode;

    return next.handle().pipe(map((data) => ({ statusCode, data })));
  }
}
```

### Parse Int Pipe Helper

```typescript
// src/lib/parse-int.pipe.ts
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseIntPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    const val = parseInt(value, 10);
    if (isNaN(val)) {
      throw new BadRequestException(`"${value}" is not a valid integer`);
    }
    return val;
  }
}
```

---

## Dependency Rules

```
@libs/server-shared  →  @libs/shared-shared     ✅ allowed
@libs/server-shared  →  @libs/shared-types       ✅ allowed
@libs/server-shared  →  @libs/server-auth        ✅ allowed
@libs/server-shared  →  @libs/client-*           ✗ forbidden
```

---

## Nx Project Info

| Field | Value |
|-------|-------|
| Nx project name | `server-shared` |
| Tags | `scope:server`, `type:shared` |
| Build executor | `@nx/js:tsc` |
| Output | `dist/libs/server-shared` |

---

## Running Tasks

```bash
# Build
pnpm nx build server-shared

# Test
pnpm nx test server-shared

# Lint
pnpm nx lint server-shared
```
