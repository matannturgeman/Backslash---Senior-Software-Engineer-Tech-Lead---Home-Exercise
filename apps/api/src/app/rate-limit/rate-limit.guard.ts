import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { CacheService } from '../cache/cache.service.js';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly limit: number;
  private readonly windowSec: number;

  constructor(
    private readonly cache: CacheService,
    config: ConfigService,
  ) {
    this.limit     = config.get<number>('RATE_LIMIT_MAX',        60);
    this.windowSec = config.get<number>('RATE_LIMIT_WINDOW_SEC', 60);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const ip  = req.ip ?? 'unknown';
    const key = `ratelimit:${ip}`;

    const count = await this.cache.increment(key, this.windowSec);

    // count === 0 → Redis unavailable → fail-open (don't block traffic)
    if (count > 0 && count > this.limit) {
      throw new HttpException(
        { statusCode: 429, message: 'Too Many Requests' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
