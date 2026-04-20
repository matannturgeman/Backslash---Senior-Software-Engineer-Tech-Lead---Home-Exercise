# Client Libraries

This directory contains all client-side logic and utilities for the Nx workspace.

## Purpose

The `libs/client` folder holds all client-side logic including Redux store management, server communication utilities, logged-in user access helpers, shared client-side utilities, and UI components/libraries.

## Structure

```
client/
├── store/                    # Redux Toolkit store configuration and slices
│   ├── index.ts             # Main store export
│   ├── authSlice.ts         # Authentication state slice
│   ├── userSlice.ts         # User data state slice
│   ├── uiSlice.ts           # UI state management (modals, alerts, etc.)
│   └── ...                  # Other feature slices
├── server-communication/     # API communication layer (REST, WS, TRPC)
│   ├── rest-client/         # Axios or fetch-based REST client
│   ├── ws-connection/       # WebSocket connection management
│   ├── trpc-client/         # TRPC client configuration (if used)
│   └── interceptors/        # Request/response interceptors
├── loggerin-user/           # Utilities to get logged-in user from client
│   ├── index.ts             # Main entry point
│   ├── hook.ts              # useLoggedInUser hook
│   └── provider.tsx         # User context provider component
├── shared/                  # Shared client-side utilities and logic
│   ├── index.ts             # Main export for all client utilities
│   ├── formatters/          # Date, currency, string formatters
│   ├── validators/          # Client-side validation helpers
│   ├── http-helpers/        # API call helpers and utils
│   └── ...                  # Other shared utilities
├── ui/                      # UI components and libraries (React/Vue/Angular)
│   ├── components/          # Reusable UI components
│   ├── layouts/             # Layout components (app shell, etc.)
│   ├── forms/               # Form components
│   └── ...                  # Other UI modules
└── index.ts                 # Main entry point for client libraries
```

## Usage Examples

### Redux Store

```typescript
// Initialize store in your application bootstrap
import { configureStore } from '@reduxjs/toolkit';
import { authSlice } from '@lib/client-store';
import { userSlice } from '@lib/client-store';

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    user: userSlice.reducer,
  },
});
```

### Server Communication

```typescript
// Using REST client
import { apiClient } from '@lib/client-server-communication';
import { HttpResponseDto } from '@lib/shared-dto';

try {
  const response = await apiClient.get('/users', { 
    params: { limit: 10, offset: 0 }
  });
} catch (error) {
  console.error(error);
}
```

### Logged-in User Hook

```typescript
// Get access to logged-in user from React hooks
import { useLoggedInUser } from '@lib/client-loggerin-user';

function UserProfile() {
  const { isAuth, user } = useLoggedInUser();
  
  if (!isAuth) {
    return <Navigate to="/login" />;
  }
  
  return <div>Welcome, {user.name}</div>;
}
```

## Available Libraries

- **@lib/client-store**: Redux Toolkit store configuration and slices
- **@lib/client-server-communication**: API client layer for REST, WebSocket, TRPC
- **@lib/client-loggerin-user**: Utilities to get logged-in user from client context
- **@lib/client-shared**: Shared client-side utilities and helpers
- **@lib/client-ui**: UI components and libraries

## Best Practices

1. Keep server communication logic isolated in `server-communication/`
2. Use typed responses from DTOs for API contract enforcement
3. Handle authentication errors gracefully using the loggerin-user utilities
4. Share common utilities through `client/shared/`
5. Use Redux slices for feature-based state management
6. Validate client input using Zod schemas from `shared/validation-schemas`

## Testing

Run tests for client libraries:

```bash
nx test client-store
nx test client-server-communication
nx test client-loggerin-user
nx test client-shared
nx test client-ui
```

## License

MIT