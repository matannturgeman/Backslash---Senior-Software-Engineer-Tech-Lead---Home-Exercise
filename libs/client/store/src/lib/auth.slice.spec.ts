import {
  authReducer,
  clearCredentials,
  selectAuthToken,
  selectCurrentUser,
  selectIsAuthenticated,
  setCredentials,
  updateUser,
  type AuthState,
} from './auth.slice';

describe('auth.slice', () => {
  const user = {
    id: 1,
    email: 'alice@example.com',
    name: 'Alice',
  };

  it('should return the initial state', () => {
    const state = authReducer(undefined, { type: 'unknown' });

    expect(state).toEqual({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  });

  it('should set credentials', () => {
    const state = authReducer(
      undefined,
      setCredentials({ user, token: 'token-123' }),
    );

    expect(state).toEqual({
      user,
      token: 'token-123',
      isAuthenticated: true,
    });
  });

  it('should clear credentials', () => {
    const authenticatedState = authReducer(
      undefined,
      setCredentials({ user, token: 'token-123' }),
    );

    const state = authReducer(authenticatedState, clearCredentials());

    expect(state).toEqual({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  });

  it('should update user fields when user exists', () => {
    const authenticatedState = authReducer(
      undefined,
      setCredentials({ user, token: 'token-123' }),
    );

    const state = authReducer(
      authenticatedState,
      updateUser({ name: 'Alice Updated' }),
    );

    expect(state.user).toEqual({
      ...user,
      name: 'Alice Updated',
    });
  });

  it('should ignore updateUser when no user exists', () => {
    const state = authReducer(undefined, updateUser({ name: 'No-op' }));

    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should expose selectors', () => {
    const state: { auth: AuthState } = {
      auth: {
        user,
        token: 'token-123',
        isAuthenticated: true,
      },
    };

    expect(selectCurrentUser(state)).toEqual(user);
    expect(selectAuthToken(state)).toBe('token-123');
    expect(selectIsAuthenticated(state)).toBe(true);
  });
});