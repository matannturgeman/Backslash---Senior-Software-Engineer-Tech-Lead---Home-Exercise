import { Controller, Get, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CACHE_SERVICE, type ICacheService } from '@libs/server-cache';
import { GRAPH_REPOSITORY, type IGraphRepository } from '@libs/server-neo4j';

type HealthStatus = 'up' | 'down';

interface ServiceHealth {
  status: HealthStatus;
  error?: string;
}

interface HealthResponse {
  status: 'ok' | 'error';
  details: {
    neo4j: ServiceHealth;
    redis: ServiceHealth;
  };
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(GRAPH_REPOSITORY) private readonly graphRepo: IGraphRepository,
    @Inject(CACHE_SERVICE) private readonly cache: ICacheService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness check for Neo4j and Redis' })
  @ApiResponse({ status: 200, description: 'Service healthy or degraded (Redis down)' })
  @ApiResponse({ status: 503, description: 'Service unavailable (Neo4j down)' })
  async check(): Promise<HealthResponse> {
    const [neo4jHealth, redisHealth] = await Promise.all([
      this.checkNeo4j(),
      this.checkRedis(),
    ]);

    if (neo4jHealth.status === 'down') {
      throw new HttpException(
        { status: 'error', details: { neo4j: neo4jHealth, redis: redisHealth } },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return { status: 'ok', details: { neo4j: neo4jHealth, redis: redisHealth } };
  }

  private async checkNeo4j(): Promise<ServiceHealth> {
    try {
      await this.graphRepo.run('RETURN 1');
      return { status: 'up' };
    } catch (err) {
      return { status: 'down', error: (err as Error).message };
    }
  }

  private async checkRedis(): Promise<ServiceHealth> {
    const ok = await this.cache.ping();
    return ok ? { status: 'up' } : { status: 'down', error: 'Redis unavailable' };
  }
}
