/* eslint-disable */

module.exports = async function () {
  const server = (globalThis as any).__SERVER_PROCESS__;
  if (server) server.kill();

  await Promise.all([
    (globalThis as any).__NEO4J_CONTAINER__?.stop(),
    (globalThis as any).__REDIS_CONTAINER__?.stop(),
  ]);

  console.log((globalThis as any).__TEARDOWN_MESSAGE__);
};
