import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerStorage } from '@nestjs/throttler';
import { CacheModule } from './cache/cache.module.js';
import { Neo4jModule } from './neo4j/neo4j.module.js';
import { GraphModule } from './graph/graph.module.js';
import { HealthModule } from './health/health.module.js';
import { AppThrottlerGuard } from './rate-limit/throttler.guard.js';
import { ThrottlerStorageRedisService } from './rate-limit/throttler-storage.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule,
    Neo4jModule,
    GraphModule,
    HealthModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl:   config.get<number>('RATE_LIMIT_WINDOW_MS', 60_000),
            limit: config.get<number>('RATE_LIMIT_MAX',       60),
          },
        ],
      }),
    }),
  ],
  providers: [
    ThrottlerStorageRedisService,
    { provide: ThrottlerStorage,  useExisting: ThrottlerStorageRedisService },
    { provide: APP_GUARD,         useClass: AppThrottlerGuard },
  ],
})
export class AppModule {}
