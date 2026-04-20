# Libraries (`libs/`)

This directory contains all shared libraries for the monorepo, organised into three top-level scopes. Every library is imported via a path alias defined in `tsconfig.base.json` — never via relative paths that cross library boundaries.

---

## Directory Structure

```
libs/
├── server/                        # Server-side (NestJS) libraries
│   ├── auth/                      # @libs/server-auth
│   ├── data-access/               # @libs/server-data-access
│   ├── user/                      # @libs/server-user
│   └── shared/                    # @libs/server-shared
│
├── client/                        # Client-side (React) libraries
│   ├── store/                     # @libs/client-store
│   ├── server-communication/      # @libs/client-server-communication
│   ├── loggedin-user/             # @libs/client-loggedin-user
│   ├── shared/                    # @libs/client-shared
│   └── ui/                        # @libs/client-ui
│
└── shared/                        # Isomorphic libraries (server + client)
    ├── validation-schemas/        # @libs/shared-validation-schemas
    ├── dto/                       # @libs/shared-dto
    ├── types/                     # @libs/shared-types
    └── shared/                    # @libs/shared-shared
```

---

## Scopes

### `libs/server/` — Server-side libraries

Libraries that run **only on the server** (NestJS context). They may import from `libs/shared/` but must never be imported by `libs/client/`.

| Library | Import alias | Purpose |
|---------|-------------|---------|
| `auth` | `@libs/server-auth` | JWT authentication guard, `@Public()` decorator, `AuthService`, `AuthModule` |
| `data-access` | `@libs/server-data-access` | Prisma client, database modules, global HTTP exception filter |
| `user` | `@libs/server-user` | `LoggedInUser` interface, `@LoggedInUser()` parameter decorator, `CurrentUserMiddleware` |
| `shared` | `@libs/server-shared` | Utilities shared between server libraries (interceptors, pipes, guards helpers) |

---

### `libs/client/` — Client-side libraries

Libraries that run **only in the browser** (React context). They may import from `libs/shared/` but must never be imported by `libs/server/`.

| Library | Import alias | Purpose |
|---------|-------------|---------|
| `store` | `@libs/client-store` | Redux Toolkit store, `authSlice`, typed `useAppSelector` / `useAppDispatch` hooks |
| `server-communication` | `@libs/client-server-communication` | Axios-based REST client with auth interceptors, `RestClient` class, `ApiError` |
| `loggedin-user` | `@libs/client-loggedin-user` | `LoggedInUserProvider`, `useLoggedInUser()`, `useCurrentUser()`, `useIsAuthenticated()` |
| `shared` | `@libs/client-shared` | Shared React hooks (`useDebounce`, `useToggle`, …), utility functions, helpers |
| `ui` | `@libs/client-ui` | Reusable React UI components (buttons, forms, layouts, …) |

---

### `libs/shared/` — Isomorphic libraries

Libraries that are **framework-agnostic** and safe to import from both `libs/server/` and `libs/client/`. They must not import from either of the other two scopes.

| Library | Import alias | Purpose |
|---------|-------------|---------|
| `validation-schemas` | `@libs/shared-validation-schemas` | Zod schemas organised by domain (user, auth, pagination, …) |
| `dto` | `@libs/shared-dto` | DTO types inferred from Zod schemas, `parseDto()` / `safeParseDto()` helpers |
| `types` | `@libs/shared-types` | TypeScript types and interfaces derived from schemas, shared across the stack |
| `shared` | `@libs/shared-shared` | Cross-cutting utilities used by other shared libs (`paginate`, `HttpResponse`, type helpers) |

---

## Dependency Rules

The following import directions are **allowed**:

```
libs/server/*     → libs/shared/*
libs/client/*     → libs/shared/*
libs/shared/*     → libs/shared/shared   (shared-shared only)
apps/api          → libs/server/*  |  libs/shared/*
apps/client       → libs/client/*  |  libs/shared/*
```

The following import directions are **forbidden**:

```
libs/client/*     ✗→  libs/server/*
libs/server/*     ✗→  libs/client/*
libs/shared/*     ✗→  libs/server/*
libs/shared/*     ✗→  libs/client/*
```

These constraints are enforced via the `@nx/enforce-module-boundaries` ESLint rule using the `scope:*` and `type:*` tags defined in each library's `project.json`.

---

## Nx Tags

Every `project.json` declares `tags` that drive the boundary rules above:

| Tag | Meaning |
|-----|---------|
| `scope:server` | Library belongs to the server scope |
| `scope:client` | Library belongs to the client scope |
| `scope:shared` | Library belongs to the shared scope |
| `type:auth` | Authentication / authorisation logic |
| `type:data-access` | Database / external data source access |
| `type:store` | State management |
| `type:ui` | Presentational React components |
| `type:shared` | Cross-cutting utilities |
| `type:dto` | Data transfer objects |
| `type:types` | TypeScript types and interfaces |
| `type:validation` | Validation schemas |

---

## Path Aliases

All path aliases are defined in `tsconfig.base.json` and follow the `@libs/<scope>-<name>` convention:

```jsonc
// tsconfig.base.json → compilerOptions.paths
{
  // Server
  "@libs/server-auth":          ["libs/server/auth/src/index.ts"],
  "@libs/server-data-access":   ["libs/server/data-access/src/index.ts"],
  "@libs/server-user":          ["libs/server/user/src/index.ts"],
  "@libs/server-shared":        ["libs/server/shared/src/index.ts"],

  // Client
  "@libs/client-store":                  ["libs/client/store/src/index.ts"],
  "@libs/client-server-communication":   ["libs/client/server-communication/src/index.ts"],
  "@libs/client-loggedin-user":          ["libs/client/loggedin-user/src/index.ts"],
  "@libs/client-shared":                 ["libs/client/shared/src/index.ts"],
  "@libs/client-ui":                     ["libs/client/ui/src/index.ts"],

  // Shared
  "@libs/shared-validation-schemas": ["libs/shared/validation-schemas/src/index.ts"],
  "@libs/shared-dto":                ["libs/shared/dto/src/index.ts"],
  "@libs/shared-types":              ["libs/shared/types/src/index.ts"],
  "@libs/shared-shared":             ["libs/shared/shared/src/index.ts"]
}
```

---

## Adding a New Library

1. Choose the correct scope (`server`, `client`, or `shared`).
2. Create the folder under `libs/<scope>/<name>/`.
3. Add the standard files:
   - `project.json` — Nx project descriptor with correct `sourceRoot`, `tags`, and build target
   - `package.json` — named `@libs/<scope>-<name>`
   - `tsconfig.json` / `tsconfig.lib.json` / `tsconfig.spec.json`
   - `jest.config.cts`
   - `eslint.config.mjs` — imports from `../eslint.config.mjs`
   - `src/index.ts` — barrel export
   - `src/lib/<name>.ts` — implementation
   - `README.md` — document purpose, exports, usage examples
4. Register the path alias in `tsconfig.base.json`.
5. Run `pnpm nx sync` to update TypeScript project references.

---

## Running Tasks

```bash
# Build a single library
pnpm nx build server-auth

# Test a single library
pnpm nx test shared-validation-schemas

# Lint a single library
pnpm nx lint client-store

# Build all libraries
pnpm nx run-many -t build --projects="libs/*"

# Test all libraries
pnpm nx run-many -t test

# Run tasks only for libraries affected by recent changes
pnpm nx affected -t build,test,lint
```

---

## Required Package Installations

Some libraries have peer dependencies that must be installed separately:

| Library | Required packages |
|---------|------------------|
| `@libs/server-auth` | `pnpm add @nestjs/jwt jsonwebtoken` and `pnpm add -D @types/jsonwebtoken` |
| `@libs/client-store` | `pnpm add @reduxjs/toolkit react-redux` |
| `@libs/client-server-communication` | `pnpm add axios` (already in root `package.json`) |
| `@libs/client-loggedin-user` | `pnpm add react react-dom` (already in root `package.json`) |