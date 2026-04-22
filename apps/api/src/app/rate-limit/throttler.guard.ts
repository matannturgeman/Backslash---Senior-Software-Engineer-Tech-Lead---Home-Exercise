import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import {
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
  InjectThrottlerOptions,
  InjectThrottlerStorage,
} from '@nestjs/throttler';

/**
 * Extends ThrottlerGuard to disable rate limiting outside of production.
 * Set NODE_ENV=production to enable throttling.
 * isProduction is cached at construction time — NODE_ENV never changes at runtime.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  private readonly isProduction: boolean;

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    config: ConfigService,
  ) {
    super(options, storageService, reflector);
    this.isProduction = config.get<string>('NODE_ENV') === 'production';
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.isProduction) return true;
    return super.canActivate(context);
  }
}
