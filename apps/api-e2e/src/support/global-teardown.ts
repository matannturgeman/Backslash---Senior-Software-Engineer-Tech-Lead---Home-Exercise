/* eslint-disable */

module.exports = async function () {
  const server = (globalThis as any).__SERVER_PROCESS__;
  if (server) server.kill();
  console.log((globalThis as any).__TEARDOWN_MESSAGE__);
};
