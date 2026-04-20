import { ZodError } from 'zod';
import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';

const genericMessage =
  'If an account exists for this email, a password reset link will be sent.';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(() => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      getUserProfile: jest.fn(),
      createForgotPasswordToken: jest.fn(),
      resetPassword: jest.fn(),
      revokeToken: jest.fn(),
      verifyToken: jest.fn(),
      signToken: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    controller = new AuthController(authService);
  });

  it('register validates request body and response payload', async () => {
    authService.register.mockResolvedValue({
      accessToken: 'token',
      tokenType: 'Bearer',
      expiresIn: 100,
      user: {
        id: 1,
        email: 'new@example.com',
        name: 'New',
      },
    });

    const result = await controller.register(
      { email: 'new@example.com', password: 'secret123', name: 'New' },
      {
        headers: {
          'x-forwarded-for': '1.2.3.4, 5.6.7.8',
          'user-agent': 'jest-agent',
        },
        ip: '127.0.0.1',
      } as never,
    );

    expect(authService.register).toHaveBeenCalledWith(
      { email: 'new@example.com', password: 'secret123', name: 'New' },
      { ipAddress: '1.2.3.4', userAgent: 'jest-agent' },
    );
    expect(result.accessToken).toBe('token');
  });

  it('register throws zod error for invalid request body', async () => {
    await expect(
      controller.register({ email: 'bad-email' }, { headers: {}, ip: 'x' } as never),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it('register throws zod error for invalid response payload', async () => {
    authService.register.mockResolvedValue({
      accessToken: 'token',
      tokenType: 'Bearer',
      expiresIn: 100,
      user: {
        id: 1,
        email: 'new@example.com',
      },
    } as never);

    await expect(
      controller.register(
        { email: 'new@example.com', password: 'secret123', name: 'New' },
        { headers: {}, ip: '127.0.0.1' } as never,
      ),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it('login validates request and response payloads', async () => {
    authService.login.mockResolvedValue({
      accessToken: 'token',
      tokenType: 'Bearer',
      expiresIn: 100,
      user: {
        id: 2,
        email: 'login@example.com',
        name: 'Login',
      },
    });

    const result = await controller.login(
      { email: 'login@example.com', password: 'secret123' },
      { headers: {}, ip: '127.0.0.1' } as never,
    );

    expect(authService.login).toHaveBeenCalledWith(
      'login@example.com',
      'secret123',
      { ipAddress: '127.0.0.1', userAgent: undefined },
    );
    expect(result.user.id).toBe(2);
  });

  it('getMe validates response shape', async () => {
    authService.getUserProfile.mockResolvedValue({
      id: 5,
      email: 'me@example.com',
      name: 'Me',
    });

    const result = await controller.getMe({ id: 5, email: 'x', name: 'x' });

    expect(result).toEqual({
      id: 5,
      email: 'me@example.com',
      name: 'Me',
    });
  });

  it('forgotPassword validates body and returns generic message', async () => {
    authService.createForgotPasswordToken.mockResolvedValue(undefined);

    const result = await controller.forgotPassword({
      email: 'lost@example.com',
    });

    expect(authService.createForgotPasswordToken).toHaveBeenCalledWith(
      'lost@example.com',
    );
    expect(result).toEqual({ message: genericMessage });
  });

  it('resetPassword validates body and response', async () => {
    authService.resetPassword.mockResolvedValue(undefined);

    const result = await controller.resetPassword({
      token: 'a'.repeat(20),
      password: 'new-secret',
    });

    expect(authService.resetPassword).toHaveBeenCalledWith(
      'a'.repeat(20),
      'new-secret',
    );
    expect(result).toEqual({ message: 'Password was reset successfully.' });
  });

  it('logout revokes bearer token when provided', async () => {
    authService.revokeToken.mockResolvedValue(undefined);

    const result = await controller.logout({
      headers: {
        authorization: 'Bearer token-xyz',
      },
    } as never);

    expect(authService.revokeToken).toHaveBeenCalledWith('token-xyz');
    expect(result).toEqual({ success: true });
  });

  it('logout succeeds without bearer token', async () => {
    authService.revokeToken.mockResolvedValue(undefined);

    const result = await controller.logout({ headers: {} } as never);

    expect(authService.revokeToken).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it('logout ignores malformed authorization schemes', async () => {
    authService.revokeToken.mockResolvedValue(undefined);

    const result = await controller.logout({
      headers: {
        authorization: 'Basic abc123',
      },
    } as never);

    expect(authService.revokeToken).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });
});
