# `@libs/server-auth`

**Path:** `libs/server/auth/`
**Scope:** Server-side (NestJS only)

---

## Purpose

Provides JWT-based authentication for the NestJS API. The guard is registered globally via `APP_GUARD`, which means **every route is protected by default**. Routes that should be publicly accessible are opted out using the `@Public()` decorator.

---

## Exports

| Symbol | Type | Description |
|--------|------|-------------|
| `AuthModule` | NestJS Module | Import once in `AppModule` to activate global JWT auth |
| `JwtAuthGuard` | NestJS Guard | Global guard that reads and verifies the Bearer token |
| `AuthService` | NestJS Service | Verifies and signs JWT tokens |
| `Public` | Decorator | Marks a route or controller as publicly accessible |
| `IS_PUBLIC_KEY` | `string` constant | Metadata key used internally by `JwtAuthGuard` |

---

## Setup

### 1. Install peer dependencies

```bash
pnpm add @nestjs/jwt jsonwebtoken
pnpm add -D @types/jsonwebtoken
```

### 2. Set the JWT secret in your environment

```env
# .env
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=7d
```

### 3. Import `AuthModule` in your `AppModule`

```typescript
// apps/api/src/app/app.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from '@libs/server-auth';

@Module({
  imports: [AuthModule],
})
export class AppModule {}
```

### 4. Implement `AuthService.verifyToken`

Open `libs/server/auth/src/lib/auth.service.ts` and replace the stub with real JWT verification:

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { LoggedInUser } from '@libs/server-user';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async verifyToken(token: string): Promise<LoggedInUser> {
    try {
      return await this.jwtService.verifyAsync<LoggedInUser>(token, {
        secret: process.env['JWT_SECRET'],
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async signToken(user: LoggedInUser): Promise<string> {
    return this.jwtService.signAsync(user, {
      secret: process.env['JWT_SECRET'],
      expiresIn: process.env['JWT_EXPIRES_IN'] ?? '7d',
    });
  }
}
```

Also register `JwtModule` in `AuthModule`:

```typescript
// libs/server/auth/src/lib/auth.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './auth.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env['JWT_SECRET'],
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
```

---

## Usage

### Protecting routes (default — no action needed)

All routes are protected automatically once `AuthModule` is imported in `AppModule`. The decoded user payload is available on `request.user` and can be injected into controller methods using the `@LoggedInUser()` decorator from `@libs/server-user`.

```typescript
import { Controller, Get } from '@nestjs/common';
import { LoggedInUser } from '@libs/server-user';
import type { LoggedInUser as ILoggedInUser } from '@libs/server-user';

@Controller('profile')
export class ProfileController {
  @Get()
  getProfile(@LoggedInUser() user: ILoggedInUser) {
    return user;
  }
}
```

### Making a route public

```typescript
import { Controller, Get, Post, Body } from '@nestjs/common';
import { Public } from '@libs/server-auth';

@Controller('auth')
export class AuthController {
  // This route is exempt from JWT verification
  @Public()
  @Post('login')
  login(@Body() body: LoginDto) {
    // ...
  }

  // This route is protected (no @Public())
  @Get('me')
  getMe() {
    // ...
  }
}
```

### Making an entire controller public

```typescript
@Public()
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
```

---

## How it works

```
Request
  │
  ├─ JwtAuthGuard.canActivate()
  │     │
  │     ├─ Check @Public() metadata → if present, allow through
  │     │
  │     ├─ Extract Bearer token from Authorization header
  │     │     → throw UnauthorizedException if missing
  │     │
  │     ├─ AuthService.verifyToken(token)
  │     │     → throw UnauthorizedException if invalid/expired
  │     │
  │     └─ Attach decoded payload to request.user → allow through
  │
  └─ Controller method receives request.user via @LoggedInUser()
```

---

## Dependencies

| Package | Version | Why |
|---------|---------|-----|
| `@nestjs/common` | `^11` | Guards, decorators, exceptions |
| `@nestjs/core` | `^11` | `APP_GUARD`, `Reflector` |
| `@nestjs/jwt` | peer | JWT sign / verify (**install separately**) |
| `@libs/server-user` | workspace | `LoggedInUser` interface |

---

## Related Libraries

- **`@libs/server-user`** — `@LoggedInUser()` parameter decorator and `CurrentUserMiddleware`
- **`@libs/server-data-access`** — Prisma / data layer (used by services that handle login logic)
- **`@libs/shared-dto`** — `LoginDto`, `RegisterDto`, `AuthResponseDto`
- **`@libs/shared-validation-schemas`** — `loginSchema`, `registerSchema`
