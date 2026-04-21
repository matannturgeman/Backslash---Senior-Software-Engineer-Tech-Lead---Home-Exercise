import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Extends ThrottlerGuard to disable rate limiting outside of production.
 * Set NODE_ENV=production to enable throttling.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env['NODE_ENV'] !== 'production') return true;
    return super.canActivate(context);
  }
}
