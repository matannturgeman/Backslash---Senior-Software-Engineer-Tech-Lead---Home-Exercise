import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from './cache/cache.module.js';
import { Neo4jModule } from './neo4j/neo4j.module.js';
import { GraphModule } from './graph/graph.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule,
    Neo4jModule,
    GraphModule,
    HealthModule,
  ],
})
export class AppModule {}
