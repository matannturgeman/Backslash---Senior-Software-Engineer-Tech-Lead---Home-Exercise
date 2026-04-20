import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key used to mark a route or controller as public (no auth required).
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator that marks a route or controller as publicly accessible,
 * bypassing the global JwtAuthGuard.
 *
 * @example
 * // Skip auth on a single route
 * @Public()
 * @Get('health')
 * healthCheck() { ... }
 *
 * // Skip auth on an entire controller
 * @Public()
 * @Controller('auth')
 * export class AuthController { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
