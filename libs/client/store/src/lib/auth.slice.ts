import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The shape of the authenticated user stored in the Redux auth slice.
 * Mirrors the LoggedInUser interface from @libs/server-user so the
 * client and server share the same user shape without creating a
 * cross-boundary dependency.
 */
export interface AuthenticatedUser {
  id: number;
  email: string;
  name: string;
}

export interface AuthState {
  /** The currently authenticated user, or null when logged out. */
  user: AuthenticatedUser | null;
  /** The raw JWT access token, or null when logged out. */
  token: string | null;
  /** Convenience flag – true when both user and token are present. */
  isAuthenticated: boolean;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
};

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /**
     * Called after a successful login / token refresh.
     * Stores the user payload and token in state.
     *
     * @example
     * dispatch(setCredentials({ user: { id: 1, email: 'a@b.com', name: 'Alice' }, token: 'jwt...' }));
     */
    setCredentials: (
      state,
      action: PayloadAction<{ user: AuthenticatedUser; token: string }>,
    ) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
    },

    /**
     * Called on logout or when the token is found to be invalid / expired.
     * Wipes all auth state.
     *
     * @example
     * dispatch(clearCredentials());
     */
    clearCredentials: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
    },

    /**
     * Allows patching individual user fields without replacing the full user
     * object (e.g. after a profile update).
     *
     * @example
     * dispatch(updateUser({ name: 'Bob' }));
     */
    updateUser: (state, action: PayloadAction<Partial<AuthenticatedUser>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
  },
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const { setCredentials, clearCredentials, updateUser } =
  authSlice.actions;

export const authReducer = authSlice.reducer;

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectCurrentUser = (state: { auth: AuthState }) =>
  state.auth.user;

export const selectAuthToken = (state: { auth: AuthState }) => state.auth.token;

export const selectIsAuthenticated = (state: { auth: AuthState }) =>
  state.auth.isAuthenticated;
