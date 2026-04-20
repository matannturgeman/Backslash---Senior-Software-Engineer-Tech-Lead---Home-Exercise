import { Global, Module } from '@nestjs/common';
import neo4j from 'neo4j-driver';
import { Neo4jService } from './neo4j.service.js';

export const NEO4J_DRIVER = 'NEO4J_DRIVER';

@Global()
@Module({
  providers: [
    {
      provide: NEO4J_DRIVER,
      useFactory: () =>
        neo4j.driver(
          process.env.NEO4J_URI ?? 'bolt://localhost:7687',
          neo4j.auth.basic(
            process.env.NEO4J_USER ?? 'neo4j',
            process.env.NEO4J_PASS ?? 'password',
          ),
        ),
    },
    Neo4jService,
  ],
  exports: [Neo4jService],
})
export class Neo4jModule {}
