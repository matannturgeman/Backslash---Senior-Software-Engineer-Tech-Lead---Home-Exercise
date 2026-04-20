import { spawn } from 'child_process';
import { waitForPortOpen } from '@nx/node/utils';

/* eslint-disable */
var __TEARDOWN_MESSAGE__: string;

module.exports = async function () {
  const host = process.env.HOST ?? 'localhost';
  const port = Number(process.env.PORT ?? 3000);

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
