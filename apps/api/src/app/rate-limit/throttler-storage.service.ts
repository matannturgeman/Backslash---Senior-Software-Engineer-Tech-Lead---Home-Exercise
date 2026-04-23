import { Inject, Injectable } from '@nestjs/common';
import { ThrottlerStorage, ThrottlerStorageRecord } from '@nestjs/throttler';
import { CACHE_SERVICE, type ICacheService } from '@libs/server-cache';

/**
 * Redis-backed ThrottlerStorage for @nestjs/throttler.
 *
 * Delegates counting to CacheService.increment() which uses Redis INCR + EXPIRE.
 * When Redis is unavailable, increment() returns 0 and this storage fails open
 * (isBlocked = false), so traffic is never blocked by cache unavailability.
 */
@Injectable()
export class ThrottlerStorageRedisService implements ThrottlerStorage {
  constructor(@Inject(CACHE_SERVICE) private readonly cache: ICacheService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const ttlSec = Math.max(1, Math.ceil(ttl / 1000));
    const totalHits = await this.cache.increment(key, ttlSec);

    // 0 = Redis unavailable → fail open
    if (totalHits === 0) {
      return { totalHits: 0, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 };
    }

    const isBlocked = totalHits > limit;
    return {
      totalHits,
      timeToExpire: ttl,
      isBlocked,
      timeToBlockExpire: isBlocked ? blockDuration : 0,
    };
  }
}
