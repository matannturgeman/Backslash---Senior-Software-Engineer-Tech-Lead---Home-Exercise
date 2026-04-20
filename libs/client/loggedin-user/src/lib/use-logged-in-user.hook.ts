// NOTE: Install required packages before using this library:
//   pnpm add @reduxjs/toolkit react-redux
//   pnpm add -D @types/react-redux

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
  createElement,
} from 'react';

// ---------------------------------------------------------------------------
// LoggedInUser type
// ---------------------------------------------------------------------------

/**
 * The shape of the authenticated user on the client side.
 * Mirrors the LoggedInUser interface from @libs/server-user so both sides
 * share the same structure without a cross-boundary import.
 */
export interface LoggedInUser {
  id: number;
  email: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface LoggedInUserContextValue {
  /** The currently authenticated user, or null when not logged in. */
  user: LoggedInUser | null;
  /** True while the initial auth state is being resolved. */
  isLoading: boolean;
  /** True when a user is present and authenticated. */
  isAuthenticated: boolean;
  /** Manually set the user (e.g. after a successful login API call). */
  setUser: (user: LoggedInUser | null) => void;
}

const LoggedInUserContext = createContext<LoggedInUserContextValue | undefined>(
  undefined,
);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface LoggedInUserProviderProps {
  children: ReactNode;
  /**
   * Optional initial user – pass this when you already have a user in a
   * parent store (e.g. Redux) and want to seed the context without an
   * additional async resolution step.
   */
  initialUser?: LoggedInUser | null;
  /**
   * Optional async function that resolves the current user from your auth
   * source of truth (e.g. a /me endpoint, a decoded JWT from localStorage).
   * Called once on mount.
   *
   * @example
   * resolveUser={async () => {
   *   const token = localStorage.getItem('accessToken');
   *   if (!token) return null;
   *   return apiClient.get<LoggedInUser>('/auth/me');
   * }}
   */
  resolveUser?: () => Promise<LoggedInUser | null>;
}

/**
 * LoggedInUserProvider
 *
 * Wraps your application (or a sub-tree) and makes the logged-in user
 * available to any descendant via `useLoggedInUser()`.
 *
 * Mount this near the top of your component tree, ideally alongside your
 * Redux Provider:
 *
 * @example
 * // src/main.tsx
 * root.render(
 *   <Provider store={store}>
 *     <LoggedInUserProvider resolveUser={() => apiClient.get('/auth/me')}>
 *       <App />
 *     </LoggedInUserProvider>
 *   </Provider>
 * );
 */
export function LoggedInUserProvider({
  children,
  initialUser = null,
  resolveUser,
}: LoggedInUserProviderProps): ReactNode {
  const [user, setUserState] = useState<LoggedInUser | null>(initialUser);
  const [isLoading, setIsLoading] = useState<boolean>(!!resolveUser);

  useEffect(() => {
    if (!resolveUser) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    resolveUser()
      .then((resolved) => {
        if (!cancelled) {
          setUserState(resolved);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUserState(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [resolveUser]);

  const setUser = useCallback((next: LoggedInUser | null) => {
    setUserState(next);
  }, []);

  const value: LoggedInUserContextValue = {
    user,
    isLoading,
    isAuthenticated: user !== null,
    setUser,
  };

  return createElement(LoggedInUserContext.Provider, { value }, children);
}

// ---------------------------------------------------------------------------
// Primary hook
// ---------------------------------------------------------------------------

/**
 * useLoggedInUser
 *
 * Returns the current logged-in user and related auth state from the nearest
 * `LoggedInUserProvider`.
 *
 * Must be used inside a `LoggedInUserProvider`.
 *
 * @example
 * function ProfilePage() {
 *   const { user, isAuthenticated, isLoading } = useLoggedInUser();
 *
 *   if (isLoading) return <Spinner />;
 *   if (!isAuthenticated) return <Redirect to="/login" />;
 *
 *   return <h1>Hello, {user.name}</h1>;
 * }
 */
export function useLoggedInUser(): LoggedInUserContextValue {
  const context = useContext(LoggedInUserContext);

  if (context === undefined) {
    throw new Error(
      'useLoggedInUser() must be used inside a <LoggedInUserProvider>. ' +
        'Wrap your component tree (or App root) with <LoggedInUserProvider>.',
    );
  }

  return context;
}

// ---------------------------------------------------------------------------
// Convenience hooks
// ---------------------------------------------------------------------------

/**
 * Returns only the user object (or null).
 * Re-renders only when the user identity changes.
 *
 * @example
 * const user = useCurrentUser();
 * return <span>{user?.name ?? 'Guest'}</span>;
 */
export function useCurrentUser(): LoggedInUser | null {
  return useLoggedInUser().user;
}

/**
 * Returns true when a user is authenticated, false otherwise.
 *
 * @example
 * const isAuthenticated = useIsAuthenticated();
 * if (!isAuthenticated) return <Navigate to="/login" />;
 */
export function useIsAuthenticated(): boolean {
  return useLoggedInUser().isAuthenticated;
}

/**
 * Returns a stable setter to update the logged-in user in context.
 * Useful after a successful login response or profile update.
 *
 * @example
 * const setUser = useSetLoggedInUser();
 *
 * async function handleLogin(credentials: LoginDto) {
 *   const { user, token } = await apiClient.post<AuthResponseDto>('/auth/login', credentials);
 *   localStorage.setItem('accessToken', token);
 *   setUser(user);
 * }
 */
export function useSetLoggedInUser(): (user: LoggedInUser | null) => void {
  return useLoggedInUser().setUser;
}
