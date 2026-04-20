import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CacheService } from '../cache/cache.service.js';
import { Neo4jService } from '../neo4j/neo4j.service.js';

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
    private readonly neo4j: Neo4jService,
    private readonly cache: CacheService,
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
      await this.neo4j.run('RETURN 1');
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
