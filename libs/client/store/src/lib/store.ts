import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '@libs/client-server-communication';
import { authReducer } from './auth.slice';

/**
 * Central Redux store for the client application.
 *
 * Includes:
 *  - `auth`            — authentication state (user, token, isAuthenticated)
 *  - `[baseApi.reducerPath]` — RTK Query cache (all server-communication endpoints)
 *
 * ### Adding new feature slices
 * ```ts
 * import { userProfileReducer } from './user-profile.slice';
 *
 * reducer: {
 *   auth: authReducer,
 *   userProfile: userProfileReducer,
 *   [baseApi.reducerPath]: baseApi.reducer,
 * }
 * ```
 *
 * ### Adding new API slices
 * Domain API slices (auth.api.ts, users.api.ts, …) inject their endpoints
 * into `baseApi` via `baseApi.injectEndpoints()`.  They are automatically
 * included once you import their hooks anywhere in the component tree.
 * No additional wiring is needed here.
 */
export const store = configureStore({
  reducer: {
    auth: authReducer,
    // RTK Query cache — must match baseApi.reducerPath ('api')
    [baseApi.reducerPath]: baseApi.reducer,
  },

  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // RTK Query internally dispatches actions with non-serializable
        // values (AbortController, etc.).  The middleware already handles
        // this via its own ignoredActions list, but the comment is here
        // as a reminder in case you need to extend it.
        ignoredActions: [],
      },
    }).concat(baseApi.middleware),

  devTools: (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.['NODE_ENV'] !== 'production',
});

/** The full Redux state shape — inferred directly from the store. */
export type RootState = ReturnType<typeof store.getState>;

/** The dispatch function type — use this instead of plain `Dispatch` for thunk support. */
export type AppDispatch = typeof store.dispatch;

