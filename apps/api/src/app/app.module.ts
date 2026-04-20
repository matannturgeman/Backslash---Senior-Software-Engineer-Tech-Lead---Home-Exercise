import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from './cache/cache.module.js';
import { Neo4jModule } from './neo4j/neo4j.module.js';
import { GraphModule } from './graph/graph.module.js';
import { HealthModule } from './health/health.module.js';
import { RateLimitGuard } from './rate-limit/rate-limit.guard.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule,
    Neo4jModule,
    GraphModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
})
export class AppModule {}
