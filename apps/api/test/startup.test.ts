import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { once } from 'node:events';
import { expect, it } from 'vitest';

it('reports an occupied listen address safely and exits unsuccessfully', async () => {
  const occupied = createServer();
  occupied.listen(0, '127.0.0.1');
  await once(occupied, 'listening');
  const address = occupied.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP address');
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    cwd: resolve(__dirname, '..'),
    env: { ...process.env, API_PROVIDER: 'mock', API_HOST: '127.0.0.1', API_PORT: String(address.port),
      API_GENERATION_TIMEOUT_MS: '5000', API_REQUEST_TIMEOUT_MS: '15000',
      PRIVATE_STARTUP_TEST_VALUE: 'must-not-appear-in-logs' },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => { stderr += chunk; });
  try {
    const [code] = await once(child, 'exit', { signal: AbortSignal.timeout(5000) });
    expect(code).toBe(1);
    const entry = stderr.trim().split('\n').map(line => JSON.parse(line))
      .find(value => value.event === 'startup_failed');
    expect(entry).toEqual({ event: 'startup_failed', code: 'EADDRINUSE', host: '127.0.0.1', port: address.port,
      message: 'Address already in use. Stop the existing backend and its watcher, or choose a different API_PORT.' });
    expect(stderr).not.toContain('must-not-appear-in-logs');
    expect(stderr).not.toContain('Error: listen');
  } finally {
    if (child.exitCode === null) child.kill('SIGTERM');
    await new Promise<void>((done, reject) => occupied.close(error => error ? reject(error) : done()));
  }
}, 10000);
