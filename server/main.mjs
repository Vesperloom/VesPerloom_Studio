import { createStudio } from './api/app.mjs';
const host = process.env.HOST || '127.0.0.1',
  port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid PORT');
const { server, shutdown, authRequired } = await createStudio();
server.on('error', (e) => {
  console.error(`Server: ${e.message}`);
  process.exitCode = 1;
});
server.listen(port, host, () => {
  console.log(`Vesperloom studio → http://${host}:${port}`);
  if (!authRequired && !['localhost', '127.0.0.1', '::1'].includes(host))
    console.warn('Shared bind without a token: use a trusted preview or private network only.');
});
function stop() {
  shutdown();
  server.close();
  server.closeIdleConnections();
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
