import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './auth.guard';
import type { AuthService } from './auth.service';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let authService: jest.Mocked<AuthService>;
  let reflector: jest.Mocked<Reflector>;

  const buildContext = (request: Record<string, unknown>): ExecutionContext =>
    ({
      getClass: jest.fn(),
      getHandler: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext);

  beforeEach(() => {
    authService = {
      verifyToken: jest.fn(),
      signToken: jest.fn(),
      register: jest.fn(),
      login: jest.fn(),
      createForgotPasswordToken: jest.fn(),
      resetPassword: jest.fn(),
      revokeToken: jest.fn(),
      getUserProfile: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new JwtAuthGuard(authService, reflector);
  });

  it('allows request when route is public', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    const result = await guard.canActivate(buildContext({ headers: {} }));

    expect(result).toBe(true);
    expect(authService.verifyToken).not.toHaveBeenCalled();
  });

  it('throws when bearer token is missing', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);

    await expect(
      guard.canActivate(buildContext({ headers: {} })),
    ).rejects.toThrow(new UnauthorizedException('No bearer token provided'));
  });

  it('throws when authorization header is not bearer', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);

    await expect(
      guard.canActivate(
        buildContext({ headers: { authorization: 'Basic abc123' } }),
      ),
    ).rejects.toThrow(new UnauthorizedException('No bearer token provided'));
  });

  it('throws when auth service returns falsy user', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    authService.verifyToken.mockResolvedValue(undefined as never);

    await expect(
      guard.canActivate(
        buildContext({ headers: { authorization: 'Bearer token-123' } }),
      ),
    ).rejects.toThrow(new UnauthorizedException('Invalid or expired token'));
  });

  it('attaches user and allows request with valid bearer token', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    authService.verifyToken.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      name: 'User',
    });

    const request: Record<string, unknown> = {
      headers: { authorization: 'Bearer token-123' },
    };

    const result = await guard.canActivate(buildContext(request));

    expect(authService.verifyToken).toHaveBeenCalledWith('token-123');
    expect(request.user).toEqual({
      id: 1,
      email: 'user@example.com',
      name: 'User',
    });
    expect(result).toBe(true);
  });
});
