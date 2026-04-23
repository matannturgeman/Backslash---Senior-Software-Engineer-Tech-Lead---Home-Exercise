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

// Throttling only applies in production — isProduction cached at construction,
// so non-production requests bypass Redis entirely.
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
