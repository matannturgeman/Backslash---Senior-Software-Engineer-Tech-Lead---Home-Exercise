# `@libs/server-user`

Server-side library for accessing the currently authenticated user inside NestJS controllers, guards, middleware, and services.

---

## Overview

This library provides three building blocks that work together to give every NestJS handler typed, zero-boilerplate access to the logged-in user:

| Export | Kind | Purpose |
|--------|------|---------|
| `LoggedInUser` | Interface | Shape of `request.user` after JWT verification |
| `@LoggedInUser()` | Param decorator | Injects `request.user` (or a single field) into a controller method |
| `CurrentUserMiddleware` | NestJS Middleware | Hook point for request-level user enrichment beyond JWT verification |

The JWT verification itself lives in `@libs/server-auth`. This library only concerns itself with **reading and exposing** the authenticated user once the guard has already run.

---

## Installation

This library has no extra runtime dependencies beyond `@nestjs/common` and `@nestjs/core`, which are already present in the monorepo root `package.json`.

---

## Exports

### `LoggedInUser` interface

```typescript
export interface LoggedInUser {
  /** Database primary key – always present after authentication */
  id: number;

  /** Verified e-mail address of the user */
  email: string;

  /** Display name of the user */
  name: string;
}
```

This is the shape of the object attached to `request.user` by `JwtAuthGuard` from `@libs/server-auth` after a valid JWT has been decoded.

Add fields here only if they are encoded directly in the JWT payload. For richer data (roles, permissions, profile pictures) use `CurrentUserMiddleware` to load them from the database or cache and merge them in.

---

### `@LoggedInUser()` parameter decorator

Extracts `request.user` (or a single field from it) and injects it as a method parameter.

```typescript
import { LoggedInUser } from '@libs/server-user';
import type { LoggedInUser as LoggedInUserType } from '@libs/server-user';
```

#### Usage — inject the full user object

```typescript
import { Controller, Get } from '@nestjs/common';
import { LoggedInUser } from '@libs/server-user';
import type { LoggedInUser as LoggedInUserType } from '@libs/server-user';

@Controller('profile')
export class ProfileController {
  @Get()
  getProfile(@LoggedInUser() user: LoggedInUserType) {
    return user; // { id: 1, email: 'alice@example.com', name: 'Alice' }
  }
}
```

#### Usage — inject a single field

```typescript
@Get('email')
getEmail(@LoggedInUser('email') email: string) {
  return { email }; // { email: 'alice@example.com' }
}
```

#### Behaviour

| Scenario | Result |
|----------|--------|
| Guard ran and user is valid | Returns the full `LoggedInUser` object (or the specified field) |
| No `data` argument | Returns the whole user object |
| `data` is a key of `LoggedInUser` | Returns `user[data]` |
| Route is public (`@Public()`) | `request.user` is `undefined` — guard did not set it |

---

### `CurrentUserMiddleware`

A NestJS `NestMiddleware` that runs on every request **after** the global `JwtAuthGuard` has already populated `request.user`. It provides a structured hook point for:

- Loading additional user data (roles, permissions, preferences) from the database
- Enriching `request.user` with data from a Redis cache
- Logging / auditing the current user context per request

#### Registering the middleware

```typescript
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CurrentUserMiddleware } from '@libs/server-user';

@Module({ /* ... */ })
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CurrentUserMiddleware)
      .forRoutes('*'); // apply to all routes
  }
}
```

#### Extending the middleware

To enrich `request.user` with database data, extend or replace the default no-op implementation:

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CurrentUserMiddleware, LoggedInUser } from '@libs/server-user';
import { UserService } from '../user/user.service';

@Injectable()
export class EnrichedUserMiddleware implements NestMiddleware {
  constructor(private readonly userService: UserService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const base = req.user as LoggedInUser | undefined;

    if (base) {
      const fullUser = await this.userService.findById(base.id);
      if (fullUser) req.user = fullUser;
    }

    next();
  }
}
```

---

## Typical Request Lifecycle

```
Incoming HTTP request
        │
        ▼
 JwtAuthGuard (@libs/server-auth)
   • Extracts Bearer token from Authorization header
   • Calls AuthService.verifyToken(token)
   • Sets request.user = LoggedInUser payload
        │
        ▼
 CurrentUserMiddleware (@libs/server-user)   ← optional enrichment
   • request.user is already populated
   • Can load extra fields from DB / cache
        │
        ▼
 Controller method
   • @LoggedInUser() user: LoggedInUser     ← injected here
```

---

## Full Example

```typescript
// apps/api/src/users/users.controller.ts

import { Controller, Get, Patch, Body } from '@nestjs/common';
import { ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LoggedInUser } from '@libs/server-user';
import type { LoggedInUser as LoggedInUserType } from '@libs/server-user';
import { UpdateUserDto } from '@libs/shared-dto';
import { UsersService } from './users.service';

@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the currently authenticated user' })
  getMe(@LoggedInUser() user: LoggedInUserType) {
    return user;
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the currently authenticated user' })
  updateMe(
    @LoggedInUser('id') userId: number,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(userId, dto);
  }
}
```

---

## Extending `LoggedInUser`

If your JWT payload carries additional claims (e.g. `roles`, `organizationId`), extend the interface here:

```typescript
// libs/server/user/src/lib/logged-in-user.interface.ts

export interface LoggedInUser {
  id: number;
  email: string;
  name: string;

  // ── Add custom claims below ────────────────────────────────────────────
  roles?: string[];
  organizationId?: number;
}
```

Make sure `AuthService.signToken()` (in `@libs/server-auth`) encodes the same fields when issuing tokens.

---

## Related Libraries

| Library | Relationship |
|---------|-------------|
| `@libs/server-auth` | Provides `JwtAuthGuard` that populates `request.user` before this lib reads it |
| `@libs/shared-types` | Source of the base `User` type if you want to align `LoggedInUser` with the DB model |
| `@libs/shared-dto` | Provides `UserResponseDto` for serialising user data in API responses |