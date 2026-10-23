import { createApiServer } from './httpServer';
import { readConfig } from './config';
import { createConfiguredProvider } from './providers';

try {
  const config = readConfig();
  const provider = createConfiguredProvider();
  const server = createApiServer({ config, provider });
  server.on('error', (error: NodeJS.ErrnoException) => {
    const details = error.code === 'EADDRINUSE' ? {
      code: 'EADDRINUSE', host: config.host, port: config.port,
      message: 'Address already in use. Stop the existing backend and its watcher, or choose a different API_PORT.',
    } : {};
    // Only validated configuration and developer-owned text; never raw errors or environment data.
    console.error(JSON.stringify({ event: 'startup_failed', ...details }));
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
