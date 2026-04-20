import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockDispatch = jest.fn();

let mockAuthState: {
  isAuthenticated: boolean;
  user: { id: number; email: string; name: string } | null;
  token: string | null;
} = {
  isAuthenticated: false,
  user: null,
  token: null,
};

const mockUseGetMeQuery = jest.fn();
const mockUseLoginMutation = jest.fn();
const mockUseRegisterMutation = jest.fn();
const mockUseLogoutMutation = jest.fn();
const mockUseForgotPasswordMutation = jest.fn();
const mockUseResetPasswordMutation = jest.fn();

jest.mock('@libs/client-store', () => ({
  clearCredentials: () => ({ type: 'auth/clearCredentials' }),
  setCredentials: (payload: unknown) => ({ type: 'auth/setCredentials', payload }),
  selectCurrentUser: (state: { auth: typeof mockAuthState }) => state.auth.user,
  selectIsAuthenticated: (state: { auth: typeof mockAuthState }) =>
    state.auth.isAuthenticated,
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: (state: { auth: typeof mockAuthState }) => unknown) =>
    selector({ auth: mockAuthState }),
}));

jest.mock('@libs/client-server-communication', () => ({
  useGetMeQuery: (...args: unknown[]) => mockUseGetMeQuery(...args),
  useLoginMutation: (...args: unknown[]) => mockUseLoginMutation(...args),
  useRegisterMutation: (...args: unknown[]) => mockUseRegisterMutation(...args),
  useLogoutMutation: (...args: unknown[]) => mockUseLogoutMutation(...args),
  useForgotPasswordMutation: (...args: unknown[]) =>
    mockUseForgotPasswordMutation(...args),
  useResetPasswordMutation: (...args: unknown[]) =>
    mockUseResetPasswordMutation(...args),
}));

import App from './app';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App auth flow', () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockAuthState = {
      isAuthenticated: false,
      user: null,
      token: null,
    };

    localStorage.clear();
    jest.useRealTimers();

    mockUseGetMeQuery.mockReset();
    mockUseGetMeQuery.mockReturnValue({
      data: undefined,
      isFetching: false,
      isSuccess: false,
      isError: false,
    });

    mockUseLoginMutation.mockReset();
    mockUseLoginMutation.mockReturnValue([
      jest.fn(),
      { isLoading: false, error: undefined },
    ]);

    mockUseRegisterMutation.mockReset();
    mockUseRegisterMutation.mockReturnValue([
      jest.fn(),
      { isLoading: false, error: undefined },
    ]);

    mockUseLogoutMutation.mockReset();
    mockUseLogoutMutation.mockReturnValue([
      jest.fn(() => ({ unwrap: () => Promise.resolve({ success: true }) })),
      { isLoading: false },
    ]);

    mockUseForgotPasswordMutation.mockReset();
    mockUseForgotPasswordMutation.mockReturnValue([
      jest.fn(),
      { isLoading: false, error: undefined },
    ]);

    mockUseResetPasswordMutation.mockReset();
    mockUseResetPasswordMutation.mockReturnValue([
      jest.fn(),
      { isLoading: false, error: undefined },
    ]);
  });

  it('dispatches clearCredentials when no persisted token exists', () => {
    renderAt('/login');

    expect(mockDispatch).toHaveBeenCalledWith({ type: 'auth/clearCredentials' });
  });

  it('redirects unauthenticated users from protected route to login', () => {
    renderAt('/');

    expect(screen.getByText('Sign in to your workspace')).toBeTruthy();
    expect(mockUseGetMeQuery).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ skip: true }),
    );
  });

  it('redirects already-authenticated users away from /login', () => {
    mockAuthState = {
      isAuthenticated: true,
      user: { id: 1, email: 'alice@example.com', name: 'Alice' },
      token: 'persisted-token',
    };
    localStorage.setItem('accessToken', 'persisted-token');

    renderAt('/login');

    expect(screen.getByText('Session Active')).toBeTruthy();
  });

  it('shows session bootstrap state when token exists and profile is loading', () => {
    localStorage.setItem('accessToken', 'persisted-token');
    mockUseGetMeQuery.mockReturnValue({
      data: undefined,
      isFetching: true,
      isSuccess: false,
      isError: false,
    });

    renderAt('/');

    expect(screen.getByText('Checking your session...')).toBeTruthy();
    expect(mockUseGetMeQuery).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ skip: false }),
    );
  });

  it('dispatches setCredentials when /auth/me succeeds with a persisted token', async () => {
    const user = { id: 7, email: 'alice@example.com', name: 'Alice' };
    localStorage.setItem('accessToken', 'persisted-token');

    mockUseGetMeQuery.mockReturnValue({
      data: user,
      isFetching: false,
      isSuccess: true,
      isError: false,
    });

    renderAt('/login');

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'auth/setCredentials',
        payload: {
          user,
          token: 'persisted-token',
        },
      });
    });
  });

  it('clears persisted token and auth state when /auth/me fails', async () => {
    localStorage.setItem('accessToken', 'persisted-token');

    mockUseGetMeQuery.mockReturnValue({
      data: undefined,
      isFetching: false,
      isSuccess: false,
      isError: true,
    });

    renderAt('/login');

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'auth/clearCredentials' });
    });

    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('shows login error message when mutation returns an error state', () => {
    mockUseLoginMutation.mockReturnValue([
      jest.fn(),
      { isLoading: false, error: { status: 401 } },
    ]);

    renderAt('/login');

    expect(
      screen.getByText('Login failed. Please check your credentials.'),
    ).toBeTruthy();
  });

  it('persists token and dispatches credentials after successful login', async () => {
    const authResponse = {
      accessToken: 'new-access-token',
      user: { id: 8, email: 'bob@example.com', name: 'Bob' },
    };

    const loginMutation = jest.fn(() => ({
      unwrap: () => Promise.resolve(authResponse),
    }));

    mockUseLoginMutation.mockReturnValue([
      loginMutation,
      { isLoading: false, error: undefined },
    ]);

    renderAt('/login');

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'bob@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Password123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(loginMutation).toHaveBeenCalledWith({
        email: 'bob@example.com',
        password: 'Password123!',
      });
    });

    expect(localStorage.getItem('accessToken')).toBe('new-access-token');
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'auth/setCredentials',
      payload: {
        user: authResponse.user,
        token: 'new-access-token',
      },
    });
  });

  it('redirects already-authenticated users away from /register', () => {
    mockAuthState = {
      isAuthenticated: true,
      user: { id: 1, email: 'alice@example.com', name: 'Alice' },
      token: 'persisted-token',
    };
    localStorage.setItem('accessToken', 'persisted-token');

    renderAt('/register');

    expect(screen.getByText('Session Active')).toBeTruthy();
  });

  it('shows register error message when mutation returns an error state', () => {
    mockUseRegisterMutation.mockReturnValue([
      jest.fn(),
      { isLoading: false, error: { status: 409 } },
    ]);

    renderAt('/register');

    expect(
      screen.getByText('Registration failed. Please try a different email.'),
    ).toBeTruthy();
  });

  it('persists token and dispatches credentials after successful registration', async () => {
    const authResponse = {
      accessToken: 'new-register-token',
      user: { id: 9, email: 'new@example.com', name: 'New User' },
    };

    const registerMutation = jest.fn(() => ({
      unwrap: () => Promise.resolve(authResponse),
    }));

    mockUseRegisterMutation.mockReturnValue([
      registerMutation,
      { isLoading: false, error: undefined },
    ]);

    renderAt('/register');

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'New User' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Password123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(registerMutation).toHaveBeenCalledWith({
        name: 'New User',
        email: 'new@example.com',
        password: 'Password123!',
      });
    });

    expect(localStorage.getItem('accessToken')).toBe('new-register-token');
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'auth/setCredentials',
      payload: {
        user: authResponse.user,
        token: 'new-register-token',
      },
    });
  });
  it('shows forgot-password success message after submit', async () => {
    const forgotPasswordMutation = jest.fn(() => ({
      unwrap: () => Promise.resolve({ message: 'Reset link sent.' }),
    }));

    mockUseForgotPasswordMutation.mockReturnValue([
      forgotPasswordMutation,
      { isLoading: false, error: undefined },
    ]);

    renderAt('/forgot-password');

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'bob@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    await waitFor(() => {
      expect(forgotPasswordMutation).toHaveBeenCalledWith({
        email: 'bob@example.com',
      });
    });

    expect(screen.getByText('Reset link sent.')).toBeTruthy();
  });

  it('shows forgot-password error message when mutation has an error', () => {
    mockUseForgotPasswordMutation.mockReturnValue([
      jest.fn(),
      { isLoading: false, error: { status: 500 } },
    ]);

    renderAt('/forgot-password');

    expect(
      screen.getByText('Could not submit request. Please try again.'),
    ).toBeTruthy();
  });

  it('prefills reset token from URL and redirects to login after success', async () => {
    jest.useFakeTimers();

    const resetPasswordMutation = jest.fn(() => ({
      unwrap: () => Promise.resolve({ message: 'Password updated.' }),
    }));

    mockUseResetPasswordMutation.mockReturnValue([
      resetPasswordMutation,
      { isLoading: false, error: undefined },
    ]);

    renderAt('/reset-password?token=from-link');

    expect((screen.getByLabelText('Reset token') as HTMLInputElement).value).toBe(
      'from-link',
    );

    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'NewPassword123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));

    await waitFor(() => {
      expect(resetPasswordMutation).toHaveBeenCalledWith({
        token: 'from-link',
        password: 'NewPassword123!',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Password updated. Redirecting to login...')).toBeTruthy();
    });

    act(() => {
      jest.advanceTimersByTime(1200);
    });

    expect(screen.getByText('Sign in to your workspace')).toBeTruthy();
  });

  it('shows reset-password error message when mutation has an error', () => {
    mockUseResetPasswordMutation.mockReturnValue([
      jest.fn(),
      { isLoading: false, error: { status: 400 } },
    ]);

    renderAt('/reset-password');

    expect(
      screen.getByText('Reset failed. The token may be invalid or expired.'),
    ).toBeTruthy();
  });

  it('redirects unknown routes based on token presence', () => {
    renderAt('/unknown');
    expect(screen.getByText('Sign in to your workspace')).toBeTruthy();

    mockAuthState = {
      isAuthenticated: true,
      user: { id: 1, email: 'alice@example.com', name: 'Alice' },
      token: 'persisted-token',
    };
    localStorage.setItem('accessToken', 'persisted-token');

    renderAt('/another-unknown');
    expect(screen.getByText('Session Active')).toBeTruthy();
  });

  it('clears local auth state on logout even if server logout fails', async () => {
    mockAuthState = {
      isAuthenticated: true,
      user: { id: 1, email: 'alice@example.com', name: 'Alice' },
      token: 'persisted-token',
    };

    localStorage.setItem('accessToken', 'persisted-token');

    const logoutMutation = jest.fn(() => ({
      unwrap: () => Promise.reject(new Error('Network error')),
    }));

    mockUseLogoutMutation.mockReturnValue([logoutMutation, { isLoading: false }]);

    renderAt('/');

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

    await waitFor(() => {
      expect(logoutMutation).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'auth/clearCredentials' });
    });

    expect(localStorage.getItem('accessToken')).toBeNull();
  });
});



