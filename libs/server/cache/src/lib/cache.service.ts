import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { ICacheService } from './cache.interface.js';

@Injectable()
export class CacheService implements ICacheService, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly client: Redis;
  private readonly ttl: number;
  // Starts false — set to true only after the first successful connection.
  // Prevents cache reads/writes before the Redis handshake completes.
  private available = false;

  constructor(config: ConfigService) {
    this.ttl = config.get<number>('CACHE_TTL', 300);

    const redisUrl = config.get<string>('REDIS_URL');
    if (redisUrl) {
      const redacted = redisUrl.replace(/:\/\/[^@]+@/, '://*****@');
      this.logger.log(`Connecting to Redis via URL: ${redacted}`);
      this.client = new Redis(redisUrl, { lazyConnect: true });
    } else {
      const host = config.get<string>('REDIS_HOST', 'localhost');
      const port = config.get<number>('REDIS_PORT', 6379);
      this.logger.log(`Connecting to Redis at ${host}:${port}`);
      this.client = new Redis({ host, port, lazyConnect: true });
    }

    this.client.on('connect', () => {
      this.available = true;
      this.logger.log('Redis connected — cache enabled');
    });

    this.client.on('error', (err: Error) => {
      if (this.available) {
        this.logger.warn(`Redis unavailable — cache disabled: ${err.message}`);
        this.available = false;
      }
    });

    // Errors surface via the 'error' event; suppress unhandled-rejection warning.
    this.client.connect().catch(() => undefined);
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.available) return null;
    try {
      const value = await this.client.get(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch (err) {
      this.logger.warn(`Cache get failed for key "${key}": ${(err as Error).message}`);
      return null;
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    if (!this.available) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', this.ttl);
    } catch (err) {
      this.logger.warn(`Cache set failed for key "${key}": ${(err as Error).message}`);
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (!this.available || keys.length === 0) return;
    try {
      await this.client.del(...keys);
    } catch (err) {
      this.logger.warn(`Cache del failed for keys [${keys.join(', ')}]: ${(err as Error).message}`);
    }
  }

  // Uses SCAN (non-blocking) to find and delete all keys matching a glob pattern.
  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.available) return;
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) await this.client.del(...keys);
      } while (cursor !== '0');
    } catch (err) {
      this.logger.warn(`Cache invalidatePattern failed for "${pattern}": ${(err as Error).message}`);
    }
  }

  // Atomically increments a counter and sets its TTL on first write.
  // Returns the new count, or 0 when Redis is unavailable (caller should fail-open).
  async increment(key: string, ttlSeconds: number): Promise<number> {
    if (!this.available) return 0;
    try {
      const count = await this.client.incr(key);
      if (count === 1) await this.client.expire(key, ttlSeconds);
      return count;
    } catch (err) {
      this.logger.warn(`Cache increment failed for key "${key}": ${(err as Error).message}`);
      return 0;
    }
  }

  async ping(): Promise<boolean> {
    if (!this.available) return false;
    try {
      await this.client.ping();
      return true;
    } catch (err) {
      this.logger.warn(`Redis ping failed — cache disabled: ${(err as Error).message}`);
      this.available = false;
      return false;
    }
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
