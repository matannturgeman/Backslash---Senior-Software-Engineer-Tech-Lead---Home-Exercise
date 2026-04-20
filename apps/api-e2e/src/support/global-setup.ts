import { spawn } from 'child_process';
import { waitForPortOpen } from '@nx/node/utils';
import { Neo4jContainer } from '@testcontainers/neo4j';
import { RedisContainer } from '@testcontainers/redis';

/* eslint-disable */
var __TEARDOWN_MESSAGE__: string;

module.exports = async function () {
  const host = process.env.HOST ?? 'localhost';
  const port = Number(process.env.PORT ?? 3000);

  console.log('\nStarting Neo4j and Redis containers...\n');

  const [neo4j, redis] = await Promise.all([
    new Neo4jContainer('neo4j:5').start(),
    new RedisContainer('redis:7').start(),
  ]);

  process.env.NEO4J_URI  = neo4j.getBoltUri();
  process.env.NEO4J_USER = neo4j.getUsername();
  process.env.NEO4J_PASS = neo4j.getPassword();
  process.env.REDIS_HOST = redis.getHost();
  process.env.REDIS_PORT = String(redis.getMappedPort(6379));

  (globalThis as any).__NEO4J_CONTAINER__  = neo4j;
  (globalThis as any).__REDIS_CONTAINER__  = redis;

  console.log('\nStarting API server for E2E tests...\n');

  const server = spawn('node', ['dist/api/main.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: 'inherit',
  });

  (globalThis as any).__SERVER_PROCESS__ = server;
  (globalThis as any).__TEARDOWN_MESSAGE__ = '\nTearing down...\n';

  await waitForPortOpen(port, { host });
};
