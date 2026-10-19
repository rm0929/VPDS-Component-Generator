import { createApiServer } from './httpServer';
import { readConfig } from './config';
import { createConfiguredProvider } from './providers';

try {
  const config = readConfig();
  const provider = createConfiguredProvider();
  const server = createApiServer({ config, provider });
  server.on('error', () => {
    console.error(JSON.stringify({ event: 'startup_failed' }));
    process.exitCode = 1;
  });
  server.listen(config.port, config.host, () => {
    console.log(JSON.stringify({ event: 'listening', host: config.host, port: config.port, provider: provider.id, isMock: provider.isMock }));
  });
  const shutdown = () => {
    server.close();
    const timer = setTimeout(() => server.closeAllConnections(), 10000);
    timer.unref();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
} catch {
  console.error(JSON.stringify({ event: 'invalid_configuration' }));
  process.exitCode = 1;
}
