import type { ManagedTransaction, QueryResult } from 'neo4j-driver';

export const GRAPH_REPOSITORY = 'GRAPH_REPOSITORY';

export interface IGraphRepository {
  run(cypher: string, params?: Record<string, unknown>): Promise<QueryResult>;
  writeTransaction(fn: (tx: ManagedTransaction) => Promise<void>): Promise<void>;
}
