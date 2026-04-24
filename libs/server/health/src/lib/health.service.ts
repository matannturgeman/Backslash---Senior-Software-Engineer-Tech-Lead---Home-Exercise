import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { CACHE_SERVICE, type ICacheService } from '@libs/server-cache';
import { GRAPH_REPOSITORY, type IGraphRepository } from '@libs/server-graph';

type HealthStatus = 'up' | 'down';

export interface ServiceHealth {
  status: HealthStatus;
  error?: string;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  details: {
    database: ServiceHealth;
    redis: ServiceHealth;
  };
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(GRAPH_REPOSITORY) private readonly graphRepo: IGraphRepository,
    @Inject(CACHE_SERVICE) private readonly cache: ICacheService,
  ) {}

  async check(): Promise<HealthResponse> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    if (database.status === 'down') {
      throw new HttpException(
        { status: 'error', details: { database, redis } },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return { status: 'ok', details: { database, redis } };
  }

  private async checkDatabase(): Promise<ServiceHealth> {
    try {
      await this.graphRepo.run('RETURN 1');
      return { status: 'up' };
    } catch (err) {
      return { status: 'down', error: (err as Error).message };
    }
  }

  private async checkRedis(): Promise<ServiceHealth> {
    try {
      const ok = await this.cache.ping();
      return ok ? { status: 'up' } : { status: 'down', error: 'Redis unavailable' };
    } catch (err) {
      return { status: 'down', error: (err as Error).message };
    }
  }
}
