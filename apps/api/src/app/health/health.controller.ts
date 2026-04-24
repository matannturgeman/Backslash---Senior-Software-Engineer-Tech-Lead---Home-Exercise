import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthService, type HealthResponse } from '@libs/server-health';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness check for Neo4j and Redis' })
  @ApiResponse({ status: 200, description: 'Service healthy or degraded (Redis down)' })
  @ApiResponse({ status: 503, description: 'Service unavailable (Neo4j down)' })
  check(): Promise<HealthResponse> {
    return this.healthService.check();
  }
}
