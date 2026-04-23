import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import neo4j from 'neo4j-driver';
import { Neo4jService } from './neo4j.service.js';
import { NEO4J_DRIVER } from './neo4j.constants.js';
import { GRAPH_REPOSITORY } from './neo4j.interface.js';

@Global()
@Module({
  providers: [
    {
      provide: NEO4J_DRIVER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        neo4j.driver(
          config.get<string>('NEO4J_URI', 'bolt://localhost:7687'),
          neo4j.auth.basic(
            config.get<string>('NEO4J_USER', 'neo4j'),
            config.get<string>('NEO4J_PASS', 'password'),
          ),
        ),
    },
    Neo4jService,
    { provide: GRAPH_REPOSITORY, useExisting: Neo4jService },
  ],
  exports: [Neo4jService, GRAPH_REPOSITORY],
})
export class Neo4jModule {}
