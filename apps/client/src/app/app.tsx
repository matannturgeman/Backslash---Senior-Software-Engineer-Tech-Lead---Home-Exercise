import { FormEvent, ReactNode, useEffect, useState } from 'react';
import {
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { KeyRound, Loader2, LogOut, ShieldCheck, Sparkles } from 'lucide-react';
import {
  clearCredentials,
  selectCurrentUser,
  selectIsAuthenticated,
  setCredentials,
  useAppDispatch,
  useAppSelector,
} from '@libs/client-store';
import {
  useForgotPasswordMutation,
  useGetMeQuery,
  useLoginMutation,
  useLogoutMutation,
  useRegisterMutation,
  useResetPasswordMutation,
} from '@libs/client-server-communication';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function getLocalStorage(): StorageLike | null {
  const storage = (globalThis as { localStorage?: StorageLike }).localStorage;
  return storage ?? null;
}

function getPersistedToken(): string | null {
  return getLocalStorage()?.getItem('accessToken') ?? null;
}

function clearPersistedToken(): void {
  getLocalStorage()?.removeItem('accessToken');
}

function persistToken(token: string): void {
  getLocalStorage()?.setItem('accessToken', token);
}

function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="auth-canvas flex min-h-screen items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md auth-float">
        <Card>
          <CardHeader className="space-y-3">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-800">
              <Sparkles className="h-3.5 w-3.5" />
              {eyebrow}
            </span>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}

function SessionGate({
  isBootstrapping,
  children,
}: {
  isBootstrapping: boolean;
  children: ReactNode;
}) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const token = getPersistedToken();

  if (isBootstrapping) {
    return (
      <div className="auth-canvas flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="flex items-center gap-3 p-6">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-700" />
            <p className="text-sm text-slate-700">Checking your session...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!token || !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function HomePage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector(selectCurrentUser);
  const [logout, { isLoading }] = useLogoutMutation();

  const onLogout = async () => {
    try {
      await logout().unwrap();
    } catch {
      // Keep logout resilient even if server request fails.
    }

    clearPersistedToken();
    dispatch(clearCredentials());
    navigate('/login', { replace: true });
  };

  return (
    <div className="auth-canvas flex min-h-screen items-center justify-center p-4 sm:p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5" />
            Session Active
          </span>
          <CardTitle className="text-3xl">Welcome back{user?.name ? `, ${user.name}` : ''}</CardTitle>
          <CardDescription>
            Your token is valid and your protected route is unlocked.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Authenticated Email</p>
            <p className="mt-1 text-base font-semibold text-slate-800">{user?.email ?? 'unknown'}</p>
          </div>
          <Button onClick={onLogout} disabled={isLoading} variant="danger" className="sm:w-auto w-full">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing out...
              </>
            ) : (
              <>
                <LogOut className="h-4 w-4" />
                Logout
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const [login, { isLoading, error }] = useLoginMutation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const response = await login({ email, password }).unwrap();
      persistToken(response.accessToken);
      dispatch(
        setCredentials({
          user: response.user,
          token: response.accessToken,
        }),
      );
      navigate('/', { replace: true });
    } catch {
      // RTK Query exposes error state.
    }
  };

  return (
    <AuthShell
      eyebrow="Secure Access"
      title="Sign in to your workspace"
      description="Use your credentials to continue. Invalid or expired sessions are redirected here automatically."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;"
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign in'
          )}
        </Button>
      </form>

      {error ? (
        <p className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
          Login failed. Please check your credentials.
        </p>
      ) : null}

      <p className="text-sm text-slate-600">
        Forgot your password?{' '}
        <Link className="font-semibold text-cyan-700 hover:text-cyan-600" to="/forgot-password">
          Reset it here
        </Link>
      </p>

      <p className="text-sm text-slate-600">
        Don&apos;t have an account?{' '}
        <Link className="font-semibold text-cyan-700 hover:text-cyan-600" to="/register">
          Create one
        </Link>
      </p>
    </AuthShell>
  );
}

function RegisterPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const [register, { isLoading, error }] = useRegisterMutation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const response = await register({ name, email, password }).unwrap();
      persistToken(response.accessToken);
      dispatch(
        setCredentials({
          user: response.user,
          token: response.accessToken,
        }),
      );
      navigate('/', { replace: true });
    } catch {
      // RTK Query exposes error state.
    }
  };

  return (
    <AuthShell
      eyebrow="New Workspace"
      title="Create your account"
      description="Register with your name, email, and password to access protected routes."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={2}
            placeholder="Your full name"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-email">Email</Label>
          <Input
            id="register-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-password">Password</Label>
          <Input
            id="register-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            placeholder="At least 8 characters"
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            'Create account'
          )}
        </Button>
      </form>

      {error ? (
        <p className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
          Registration failed. Please try a different email.
        </p>
      ) : null}

      <p className="text-sm text-slate-600">
        Already have an account?{' '}
        <Link className="font-semibold text-cyan-700 hover:text-cyan-600" to="/login">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

function ForgotPasswordPage() {
  const [forgotPassword, { isLoading, error }] = useForgotPasswordMutation();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const response = await forgotPassword({ email }).unwrap();
      setMessage(response.message);
    } catch {
      setMessage(null);
    }
  };

  return (
    <AuthShell
      eyebrow="Recovery"
      title="Forgot your password?"
      description="Request a reset link. For security, the response is generic regardless of account existence."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="forgot-email">Email</Label>
          <Input
            id="forgot-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            required
          />
        </div>
        <Button type="submit" className="w-full" variant="secondary" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            'Send reset link'
          )}
        </Button>
      </form>

      {message ? (
        <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <p>{message}</p>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
          Could not submit request. Please try again.
        </p>
      ) : null}

      <p className="text-sm text-slate-600">
        <Link className="inline-flex items-center gap-1 font-semibold text-cyan-700 hover:text-cyan-600" to="/login">
          <KeyRound className="h-4 w-4" />
          Back to login
        </Link>
      </p>
    </AuthShell>
  );
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [resetPassword, { isLoading, error }] = useResetPasswordMutation();

  const [token, setToken] = useState(searchParams.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const response = await resetPassword({ token, password }).unwrap();
      setMessage(response.message);

      window.setTimeout(() => {
        navigate('/login', { replace: true });
      }, 1200);
    } catch {
      setMessage(null);
    }
  };

  return (
    <AuthShell
      eyebrow="Credential Reset"
      title="Set a new password"
      description="Use the reset token from your email and choose a fresh password."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="token">Reset token</Label>
          <Input
            id="token"
            type="text"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Paste token"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            placeholder="At least 8 characters"
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Resetting...
            </>
          ) : (
            'Reset password'
          )}
        </Button>
      </form>

      {message ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message} Redirecting to login...
        </p>
      ) : null}

      {error ? (
        <p className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
          Reset failed. The token may be invalid or expired.
        </p>
      ) : null}

      <p className="text-sm text-slate-600">
        <Link className="font-semibold text-cyan-700 hover:text-cyan-600" to="/login">
          Back to login
        </Link>
      </p>
    </AuthShell>
  );
}

export function App() {
  const dispatch = useAppDispatch();

  const token = getPersistedToken();
  const { data: me, isFetching, isSuccess, isError } = useGetMeQuery(undefined, {
    skip: !token,
    refetchOnMountOrArgChange: true,
  });

  useEffect(() => {
    if (!token) {
      dispatch(clearCredentials());
      return;
    }

    if (isSuccess && me) {
      dispatch(
        setCredentials({
          user: me,
          token,
        }),
      );
    }

    if (isError) {
      clearPersistedToken();
      dispatch(clearCredentials());
    }
  }, [dispatch, isError, isSuccess, me, token]);

  const isBootstrapping = Boolean(token) && isFetching;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/"
        element={
          <SessionGate isBootstrapping={isBootstrapping}>
            <HomePage />
          </SessionGate>
        }
      />
      <Route path="*" element={<Navigate to={token ? '/' : '/login'} replace />} />
    </Routes>
  );
}

export default App;









