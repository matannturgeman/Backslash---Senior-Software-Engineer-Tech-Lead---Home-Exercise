# `@libs/client-store`

Redux Toolkit store for client-side state management across all React applications in the monorepo.

---

## Purpose

This library is the **single source of truth for all client-side application state**. It provides:

- A pre-configured Redux store with sensible defaults
- The `authSlice` — authentication state (current user, JWT token, `isAuthenticated`)
- Typed `useAppDispatch` and `useAppSelector` hooks — use these instead of the plain Redux hooks

---

## Setup

### 1. Install peer dependencies

```bash
pnpm add @reduxjs/toolkit react-redux
```

### 2. Wrap your app with the Redux Provider

```tsx
// apps/client/src/main.tsx
import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from '@libs/client-store';
import App from './app/app';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>
);
```

---

## Exports

| Symbol | Kind | Description |
|--------|------|-------------|
| `store` | Redux store | The configured application store |
| `RootState` | Type | Inferred shape of the full Redux state tree |
| `AppDispatch` | Type | Typed dispatch function (supports thunks) |
| `useAppDispatch` | Hook | Typed wrapper around `useDispatch` |
| `useAppSelector` | Hook | Typed wrapper around `useSelector` |
| `authSlice` | Slice | Redux slice for authentication state |
| `authReducer` | Reducer | Auth state reducer |
| `setCredentials` | Action | Store user + token after a successful login |
| `clearCredentials` | Action | Wipe auth state on logout |
| `updateUser` | Action | Patch specific fields on the current user |
| `selectCurrentUser` | Selector | `(state) => state.auth.user` |
| `selectAuthToken` | Selector | `(state) => state.auth.token` |
| `selectIsAuthenticated` | Selector | `(state) => state.auth.isAuthenticated` |
| `AuthenticatedUser` | Interface | Shape of the user stored in auth state |
| `AuthState` | Interface | Full shape of the auth slice state |

---

## Auth Slice

### State shape

```typescript
interface AuthState {
  user: AuthenticatedUser | null;   // null when logged out
  token: string | null;             // raw JWT access token
  isAuthenticated: boolean;         // true when user + token are present
}

interface AuthenticatedUser {
  id: number;
  email: string;
  name: string;
}
```

### Actions

#### `setCredentials`

Dispatch this after a successful login or token refresh:

```typescript
import { setCredentials, useAppDispatch } from '@libs/client-store';

const dispatch = useAppDispatch();

async function handleLogin(credentials: LoginDto) {
  const { user, token } = await apiClient.post<AuthResponseDto>('/auth/login', credentials);
  dispatch(setCredentials({ user, token }));
}
```

#### `clearCredentials`

Dispatch this on logout:

```typescript
import { clearCredentials, useAppDispatch } from '@libs/client-store';

const dispatch = useAppDispatch();

function handleLogout() {
  localStorage.removeItem('accessToken');
  dispatch(clearCredentials());
}
```

#### `updateUser`

Patch individual user fields without replacing the whole user object:

```typescript
import { updateUser, useAppDispatch } from '@libs/client-store';

const dispatch = useAppDispatch();

async function handleProfileUpdate(data: { name: string }) {
  await apiClient.patch('/users/me', data);
  dispatch(updateUser({ name: data.name }));
}
```

---

## Hooks

### `useAppDispatch`

Use this instead of the plain `useDispatch` hook to get full TypeScript support for thunks and typed actions.

```tsx
import { useAppDispatch, clearCredentials } from '@libs/client-store';

function LogoutButton() {
  const dispatch = useAppDispatch();

  return (
    <button onClick={() => dispatch(clearCredentials())}>
      Logout
    </button>
  );
}
```

### `useAppSelector`

Use this instead of the plain `useSelector` hook — no need to annotate the `state` parameter.

```tsx
import { useAppSelector, selectCurrentUser, selectIsAuthenticated } from '@libs/client-store';

function NavBar() {
  const user = useAppSelector(selectCurrentUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  return (
    <nav>
      {isAuthenticated ? (
        <span>Hello, {user?.name}</span>
      ) : (
        <a href="/login">Login</a>
      )}
    </nav>
  );
}
```

---

## Selectors

Pre-built selectors are exported for convenience — use these instead of
writing inline `(state) => state.auth.*` expressions everywhere:

```typescript
import {
  useAppSelector,
  selectCurrentUser,
  selectAuthToken,
  selectIsAuthenticated,
} from '@libs/client-store';

// In any component:
const user            = useAppSelector(selectCurrentUser);
const token           = useAppSelector(selectAuthToken);
const isAuthenticated = useAppSelector(selectIsAuthenticated);
```

---

## Adding a New Slice

1. Create `libs/client/store/src/lib/<feature>.slice.ts`
2. Define state, initial state, slice, and selectors
3. Export the reducer, actions, and selectors from the file
4. Register the reducer in `store.ts`:

```typescript
// libs/client/store/src/lib/store.ts
import { configureStore } from '@reduxjs/toolkit';
import { authReducer } from './auth.slice';
import { uiReducer } from './ui.slice';      // ← new slice

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,                           // ← register here
  },
});
```

5. Export the new slice from `src/index.ts`:

```typescript
export * from './lib/ui.slice';
```

---

## Integration with `@libs/client-loggedin-user`

The `client-loggedin-user` library provides a React context-based `LoggedInUserProvider` and `useLoggedInUser()` hook. For most components that only need the current user, prefer that hook over directly reading from the store — it avoids coupling presentational components to Redux.

Use the store directly when you need to **write** auth state (login / logout / token refresh), or when building non-React utilities (e.g. Axios interceptors).

```typescript
// Axios interceptor reads the token from the store directly
import { store } from '@libs/client-store';

export const apiClient = createApiClient({
  getToken: () => store.getState().auth.token,
  onUnauthorized: () => store.dispatch(clearCredentials()),
});
```

---

## Nx Project Info

| Field | Value |
|-------|-------|
| Nx project name | `client-store` |
| Import alias | `@libs/client-store` |
| Tags | `scope:client`, `type:store` |
| Build executor | `@nx/js:tsc` |
| Output | `dist/libs/client-store` |

---

## Running Tasks

```bash
pnpm nx build client-store
pnpm nx test  client-store
pnpm nx lint  client-store
```

---

## Related Libraries

| Library | Relationship |
|---------|-------------|
| `@libs/client-loggedin-user` | Context-based user hook — reads from this store or resolves independently |
| `@libs/client-server-communication` | API client — reads the token from `store.getState().auth.token` |
| `@libs/shared-types` | `AuthenticatedUser` mirrors `User` from shared types |
| `@libs/shared-dto` | `LoginDto`, `AuthResponseDto` used in the login flow that dispatches `setCredentials` |