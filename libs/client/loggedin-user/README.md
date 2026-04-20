# `@libs/client-loggedin-user`

Client-side utility library for accessing the currently authenticated user in React applications.

---

## Overview

This library provides a React context, provider, and a collection of hooks that give any component in the tree typed, zero-boilerplate access to the logged-in user — without coupling the component to Redux, localStorage, or any specific auth backend.

| Export | Kind | Description |
|--------|------|-------------|
| `LoggedInUser` | Interface | Shape of the authenticated user on the client side |
| `LoggedInUserProvider` | React Component | Context provider — mount once near the app root |
| `useLoggedInUser()` | Hook | Full context: `user`, `isAuthenticated`, `isLoading`, `setUser` |
| `useCurrentUser()` | Hook | Returns `LoggedInUser \| null` |
| `useIsAuthenticated()` | Hook | Returns `boolean` |
| `useSetLoggedInUser()` | Hook | Returns the stable `setUser` setter |

---

## Installation

No extra dependencies are required. React is already present in the root `package.json`.

```bash
# If not already installed:
pnpm add react react-dom
```

---

## The `LoggedInUser` interface

```typescript
export interface LoggedInUser {
  id: number;
  email: string;
  name: string;
}
```

This mirrors the `LoggedInUser` interface from `@libs/server-user` so both sides of the stack share the same shape without a cross-boundary import.

---

## Setup — Mounting the Provider

Mount `LoggedInUserProvider` once, near the root of your application. Pass a `resolveUser` callback that returns the current user from your auth source of truth (a `/me` endpoint, a decoded JWT from localStorage, etc.).

```tsx
// apps/client/src/main.tsx
import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { LoggedInUserProvider } from '@libs/client-loggedin-user';
import { store } from '@libs/client-store';
import { getApiClient } from '@libs/client-server-communication';
import App from './app/app';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <LoggedInUserProvider
          resolveUser={async () => {
            const token = localStorage.getItem('accessToken');
            if (!token) return null;
            try {
              return await getApiClient().get('/auth/me');
            } catch {
              return null;
            }
          }}
        >
          <App />
        </LoggedInUserProvider>
      </BrowserRouter>
    </Provider>
  </StrictMode>
);
```

### Provider props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `children` | `ReactNode` | ✅ | The component subtree |
| `initialUser` | `LoggedInUser \| null` | ✗ | Seed the user synchronously (e.g. from Redux state) |
| `resolveUser` | `() => Promise<LoggedInUser \| null>` | ✗ | Async factory called once on mount to resolve the current user |

---

## Hooks

### `useLoggedInUser()`

Returns the full context value. Use this when you need more than one field.

```tsx
import { useLoggedInUser } from '@libs/client-loggedin-user';

function Header() {
  const { user, isAuthenticated, isLoading, setUser } = useLoggedInUser();

  if (isLoading) return <Spinner />;

  return isAuthenticated
    ? <span>Hello, {user!.name}</span>
    : <a href="/login">Sign in</a>;
}
```

---

### `useCurrentUser()`

Returns `LoggedInUser | null`. Re-renders only when the user identity changes.

```tsx
import { useCurrentUser } from '@libs/client-loggedin-user';

function Avatar() {
  const user = useCurrentUser();
  return <img src={`/avatars/${user?.id ?? 'guest'}.png`} alt={user?.name ?? 'Guest'} />;
}
```

---

### `useIsAuthenticated()`

Returns `true` when a user is present, `false` otherwise.

```tsx
import { Navigate } from 'react-router-dom';
import { useIsAuthenticated } from '@libs/client-loggedin-user';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useIsAuthenticated();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}
```

---

### `useSetLoggedInUser()`

Returns the stable `setUser` setter. Use it after a successful login or profile update to push a new user into context without remounting the provider.

```tsx
import { useSetLoggedInUser } from '@libs/client-loggedin-user';
import { useAppDispatch } from '@libs/client-store';
import { setCredentials } from '@libs/client-store';
import type { LoginDto, AuthResponseDto } from '@libs/shared-dto';

function LoginForm() {
  const setUser = useSetLoggedInUser();
  const dispatch = useAppDispatch();

  async function handleLogin(credentials: LoginDto) {
    const { user, token } = await apiClient.post<AuthResponseDto>('/auth/login', credentials);

    // 1. Persist token
    localStorage.setItem('accessToken', token);

    // 2. Update Redux store
    dispatch(setCredentials({ user, token }));

    // 3. Update local user context
    setUser(user);
  }

  return (
    <form onSubmit={...}>
      {/* form fields */}
    </form>
  );
}
```

---

## Logout Pattern

```tsx
import { useSetLoggedInUser } from '@libs/client-loggedin-user';
import { useAppDispatch } from '@libs/client-store';
import { clearCredentials } from '@libs/client-store';

function LogoutButton() {
  const setUser = useSetLoggedInUser();
  const dispatch = useAppDispatch();

  function handleLogout() {
    localStorage.removeItem('accessToken');
    dispatch(clearCredentials());
    setUser(null);
  }

  return <button onClick={handleLogout}>Log out</button>;
}
```

---

## Integration with Redux (`@libs/client-store`)

The context and the Redux store are intentionally independent. You can keep them in sync manually (as shown above) or seed the context from the store's initial state using the `initialUser` prop:

```tsx
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '@libs/client-store';
import { LoggedInUserProvider } from '@libs/client-loggedin-user';

function AuthBridge({ children }: { children: React.ReactNode }) {
  // Seed context from Redux so both sources stay in sync from the start.
  const storeUser = useSelector(selectCurrentUser);

  return (
    <LoggedInUserProvider initialUser={storeUser}>
      {children}
    </LoggedInUserProvider>
  );
}
```

---

## Error Boundary

`useLoggedInUser()` throws a descriptive error if called outside a `LoggedInUserProvider`:

```
useLoggedInUser() must be used inside a <LoggedInUserProvider>.
Wrap your component tree (or App root) with <LoggedInUserProvider>.
```

---

## Extending `LoggedInUser`

Add fields to the interface to carry extra client-side user data (avatar URL, locale, roles, etc.):

```typescript
// libs/client/loggedin-user/src/lib/use-logged-in-user.hook.ts

export interface LoggedInUser {
  id: number;
  email: string;
  name: string;

  // ── Extensions ────────────────────────────────────────
  avatarUrl?: string;
  locale?: string;
  roles?: string[];
}
```

Make sure your `/auth/me` endpoint (or JWT payload) returns the same fields.

---

## Nx Project Info

| Field | Value |
|-------|-------|
| Nx project name | `client-loggedin-user` |
| Import alias | `@libs/client-loggedin-user` |
| Tags | `scope:client`, `type:util` |
| Build executor | `@nx/vite:build` |
| Output | `dist/libs/client-loggedin-user` |

---

## Running Tasks

```bash
# Build
pnpm nx build client-loggedin-user

# Test
pnpm nx test client-loggedin-user

# Lint
pnpm nx lint client-loggedin-user
```

---

## Related Libraries

| Library | Relationship |
|---------|-------------|
| `@libs/client-store` | Redux auth slice — keep in sync with this context on login/logout |
| `@libs/client-server-communication` | Used in `resolveUser` to call the `/auth/me` endpoint |
| `@libs/server-user` | Server-side mirror — `@LoggedInUser()` decorator reads the same user shape |
| `@libs/shared-dto` | `AuthResponseDto` — shape of the login API response |
| `@libs/shared-types` | `User` type — base type that `LoggedInUser` aligns with |