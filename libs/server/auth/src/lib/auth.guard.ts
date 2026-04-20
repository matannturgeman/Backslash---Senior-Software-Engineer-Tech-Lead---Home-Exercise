import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './auth.decorator';
import { AuthService } from './auth.service';

/**
 * Global JWT authentication guard.
 *
 * Reads the Bearer token from the Authorization header, verifies it via
 * AuthService, and attaches the decoded user payload to `request.user`.
 *
 * Routes decorated with @Public() are allowed through without a token.
 *
 * Registration (in AuthModule):
 * ```typescript
 * { provide: APP_GUARD, useClass: JwtAuthGuard }
 * ```
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Record<string, unknown>>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('No bearer token provided');
    }

    const user = await this.authService.verifyToken(token);

    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    request['user'] = user;
    return true;
  }

  private extractBearerToken(
    request: Record<string, unknown>,
  ): string | undefined {
    const headers = request['headers'] as Record<string, string> | undefined;
    const authHeader = headers?.['authorization'];
    if (!authHeader) return undefined;

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' && token ? token : undefined;
  }
}
