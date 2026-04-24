import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type { Driver, ManagedTransaction, QueryResult } from 'neo4j-driver';
import { NEO4J_DRIVER } from './neo4j.constants.js';
import type { IGraphRepository } from '@libs/server-graph';

@Injectable()
export class Neo4jService implements IGraphRepository, OnModuleDestroy {
  constructor(@Inject(NEO4J_DRIVER) private readonly driver: Driver) {}

  async run(cypher: string, params: Record<string, unknown> = {}): Promise<QueryResult> {
    const session = this.driver.session();
    try {
      return await session.run(cypher, params);
    } finally {
      await session.close();
    }
  }

  async writeTransaction(
    fn: (tx: ManagedTransaction) => Promise<void>,
  ): Promise<void> {
    const session = this.driver.session();
    try {
      await session.executeWrite(fn);
    } finally {
      await session.close();
    }
  }

  async onModuleDestroy() {
    await this.driver.close();
  }
}
