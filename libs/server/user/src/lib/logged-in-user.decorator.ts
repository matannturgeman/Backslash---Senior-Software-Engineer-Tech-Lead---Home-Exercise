import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { LoggedInUser } from './logged-in-user.interface';

/**
 * Parameter decorator that extracts the authenticated user from the current
 * HTTP request object (populated by JwtAuthGuard from @libs/server-auth).
 *
 * Renamed from `LoggedInUser` to `CurrentUser` to avoid a TypeScript
 * declaration-merge conflict with the `LoggedInUser` interface exported from
 * the same library.
 *
 * @example
 * // Inject the full logged-in user
 * @Get('profile')
 * getProfile(@CurrentUser() user: LoggedInUser) {
 *   return user;
 * }
 *
 * @example
 * // Inject a single field
 * @Get('me')
 * getEmail(@CurrentUser('email') email: string) {
 *   return { email };
 * }
 */
export const CurrentUser = createParamDecorator(
  (field: keyof LoggedInUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: LoggedInUser }>();
    const user = request.user;

    if (!user) {
      return undefined;
    }

    return field ? user[field] : user;
  },
);
