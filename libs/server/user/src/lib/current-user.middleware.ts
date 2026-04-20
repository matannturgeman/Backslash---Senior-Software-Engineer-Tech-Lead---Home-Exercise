import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * CurrentUserMiddleware
 *
 * A lightweight NestJS middleware that runs on every request.
 * Its primary role is to act as a hook point for request-level user enrichment
 * that goes beyond basic JWT verification (which is handled by JwtAuthGuard in
 * @libs/server-auth).
 *
 * Use cases:
 *  - Attach additional user metadata fetched from the database to `request.user`
 *  - Log the current user context for observability / audit trails
 *  - Enrich `request.user` with roles/permissions loaded from a cache (e.g. Redis)
 *
 * ─── Registration ────────────────────────────────────────────────────────────
 * Apply this middleware in your AppModule (or any feature module):
 *
 * @example
 * import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
 * import { CurrentUserMiddleware } from '@libs/server-user';
 *
 * @Module({})
 * export class AppModule implements NestModule {
 *   configure(consumer: MiddlewareConsumer) {
 *     consumer.apply(CurrentUserMiddleware).forRoutes('*');
 *   }
 * }
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Note: This middleware runs AFTER the JwtAuthGuard has already validated the
 * token and populated `request.user` with the base LoggedInUser payload.
 */
@Injectable()
export class CurrentUserMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    /**
     * At this point, `req.user` has already been populated by JwtAuthGuard
     * with the decoded JWT payload (a LoggedInUser object).
     *
     * To enrich the user with database-loaded data, inject a UserService or
     * cache client and resolve it here. Example:
     *
     * @example
     * if (req.user) {
     *   const fullUser = await this.userService.findById((req.user as LoggedInUser).id);
     *   req.user = fullUser ?? req.user;
     * }
     */
    next();
  }
}
