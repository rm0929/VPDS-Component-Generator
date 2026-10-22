import { EventEmitter } from 'node:events';
import { createServer as createHttpServer } from 'node:http';
import type { Server } from 'node:http';
import { createServer as createViteServer } from 'vite';
import type { HttpProxy } from 'vite';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createApiProxy } from '../../dev/apiProxy';
import { createApp } from '../src/app';
import { readConfig } from '../src/config';
import { createOllamaProvider } from '../src/ollamaProvider';
import { readProviderConfig } from '../src/providerConfig';
import { uiSpecificationSchema } from '../../src/specification/uiSpecification';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
async function within<T>(promise: Promise<T>, ms = 1000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Proxy lifecycle event did not complete promptly')), ms);
    })]);
  } finally { clearTimeout(timer); }
}
async function listen(server: Server) {
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected loopback port');
  return `http://127.0.0.1:${address.port}`;
}
const selection = { version: 'selection-poc-2', form: { enabled: false, label: null }, unsupported: [],
  components: [{ type: 'text', props: { content: 'Proxy check' } }] };
const envelope = JSON.stringify({ done: true, message: { role: 'assistant', content: JSON.stringify(selection) } });
type Fixture = {
  post: (signal?: AbortSignal) => Promise<Response>;
  started: Promise<{ uploadComplete: boolean; headersSent: boolean }>;
  closed: Promise<void>;
  wasClosed: () => boolean;
  finish: () => void;
  calls: () => number;
};

/** Real Vite → Express → production provider → fake HTTP Ollama; no inference. */
async function withProxy(run: (fixture: Fixture) => Promise<void>, mode: 'hold' | 'stream' | number = 'hold', timeoutMs = 5000) {
  const started = deferred<{ uploadComplete: boolean; headersSent: boolean }>();
  const closed = deferred<void>();
  let wasClosed = false;
  let finish = () => {};
  let calls = 0;
  const fakeOllama = createHttpServer((request, response) => {
    request.resume();
    request.once('end', () => {
      calls++;
      const send = () => response.setHeader('Content-Type', 'application/json').end(envelope);
      if (calls > 1) { send(); return; }
      response.once('close', () => {
        if (!response.writableFinished) { wasClosed = true; closed.resolve(); }
      });
      if (mode === 'stream') response.writeHead(200, { 'Content-Type': 'application/json' }).write('{');
      finish = send;
      started.resolve({ uploadComplete: request.complete, headersSent: response.headersSent });
      if (typeof mode === 'number') response.writeHead(mode).end('Private provider error');
    });
  });
  const servers = [fakeOllama];
  let vite: Awaited<ReturnType<typeof createViteServer>> | undefined;
  try {
    const baseUrl = await listen(fakeOllama);
    const config = readProviderConfig({ API_PROVIDER: 'ollama', OLLAMA_WORKFLOW: 'flat-selection' });
    if (config.provider !== 'ollama') throw new Error('Expected Ollama configuration');
    const provider = createOllamaProvider({ ...config, baseUrl, timeoutMs });
    const api = createHttpServer(createApp({ config: readConfig({}), provider, logger: () => {} }));
    servers.push(api);
    const apiUrl = await listen(api);
    vite = await createViteServer({ configFile: false, envFile: false, logLevel: 'silent',
      optimizeDeps: { noDiscovery: true, include: [] },
      server: { middlewareMode: true, hmr: false, watch: null, proxy: { '/api': createApiProxy(apiUrl) } },
    });
    const frontend = createHttpServer(vite.middlewares);
    servers.push(frontend);
    const url = await listen(frontend);
    await run({
      post: signal => fetch(`${url}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Read-only protocol fixture' }), signal }),
      started: started.promise, closed: closed.promise, wasClosed: () => wasClosed, finish: () => finish(), calls: () => calls,
    });
  } finally {
    servers.forEach(server => server.closeAllConnections());
    await Promise.all(servers.map(server => new Promise<void>(resolve => server.close(() => resolve()))));
    await vite?.close();
  }
}
async function expectSuccess(response: Response) {
  expect(response.status).toBe(200);
  const body = z.strictObject({
    data: z.strictObject({ specification: uiSpecificationSchema }),
    meta: z.strictObject({ provider: z.literal('ollama-local-flat-selection'), isMock: z.literal(false) }),
    requestId: z.uuid(),
  }).parse(await response.json());
  expect(body.data.specification.root).toMatchObject({ type: 'text', props: { content: 'Proxy check' } });
}

describe('actual development proxy generation lifecycle (mocked Ollama)', () => {
  it('allows a completed upload to wait for and receive a normal successful response', () => withProxy(async fixture => {
    const pending = fixture.post();
    expect(await within(fixture.started)).toEqual({ uploadComplete: true, headersSent: false });
    // Let normal IncomingMessage completion/close events run before responding.
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(fixture.wasClosed()).toBe(false);
    fixture.finish();
    await expectSuccess(await pending);
    await expectSuccess(await fixture.post());
    expect(fixture.wasClosed()).toBe(false);
    expect(fixture.calls()).toBe(2);
  }));

  it.each(['hold', 'stream'] as const)('cancels after upload during %s and immediately permits a subsequent generation', mode => withProxy(async fixture => {
    const controller = new AbortController();
    const pending = fixture.post(controller.signal).catch(() => undefined);
    expect(await within(fixture.started)).toEqual({ uploadComplete: true, headersSent: mode === 'stream' });
    controller.abort();
    await pending;
    await within(fixture.closed);
    expect(fixture.wasClosed()).toBe(true);
    await expectSuccess(await fixture.post()); // Must not return GENERATION_BUSY.
    expect(fixture.calls()).toBe(2);
  }, mode));

  it('preserves timeout status, actual provider cancellation, and recovery', () => withProxy(async fixture => {
    const pending = fixture.post();
    await within(fixture.started);
    const response = await pending;
    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ error: { code: 'GENERATION_TIMEOUT' }, requestId: expect.any(String) });
    await within(fixture.closed);
    await expectSuccess(await fixture.post());
  }, 'hold', 400));

  it.each([[404, 503, 'OLLAMA_MODEL_NOT_FOUND'], [503, 502, 'OLLAMA_REQUEST_FAILED']] as const)(
    'preserves provider HTTP %s error classification and recovery', (status, expectedStatus, code) => withProxy(async fixture => {
      const response = await fixture.post();
      expect(response.status).toBe(expectedStatus);
      const body = await response.json();
      expect(body).toMatchObject({ error: { code }, requestId: expect.any(String) });
      expect(JSON.stringify(body)).not.toContain('Private');
      await expectSuccess(await fixture.post());
    }, status),
  );
});

describe('proxy listener ownership', () => {
  function setup(disconnected = false) {
    const proxy = new EventEmitter();
    const options = createApiProxy('http://127.0.0.1:3001');
    options.configure?.(proxy as HttpProxy.Server, options);
    const upstream = Object.assign(new EventEmitter(), { destroy: vi.fn() });
    const request = new EventEmitter();
    const response = Object.assign(new EventEmitter(), { writableFinished: false, destroyed: disconnected });
    proxy.emit('proxyReq', upstream, request, response, {});
    return { upstream, request, response };
  }
  it('does not interpret ordinary request-body completion as disconnection', () => {
    const { upstream, request, response } = setup();
    request.emit('end'); request.emit('close');
    expect(upstream.destroy).not.toHaveBeenCalled();
    response.writableFinished = true; response.emit('finish');
    expect(response.listenerCount('close')).toBe(0);
    expect(response.listenerCount('finish')).toBe(0);
    expect(upstream.listenerCount('close')).toBe(0);
    response.emit('close');
    expect(upstream.destroy).not.toHaveBeenCalled();
  });
  it.each(['disconnect', 'already-disconnected', 'upstream-close', 'completed-close'] as const)('cleans up listeners on %s', ending => {
    const { upstream, response } = setup(ending === 'already-disconnected');
    if (ending === 'upstream-close') upstream.emit('close');
    else if (ending !== 'already-disconnected') {
      response.writableFinished = ending === 'completed-close'; response.emit('close');
    }
    expect(upstream.destroy).toHaveBeenCalledTimes(ending === 'disconnect' || ending === 'already-disconnected' ? 1 : 0);
    expect(response.listenerCount('close')).toBe(0);
    expect(response.listenerCount('finish')).toBe(0);
    expect(upstream.listenerCount('close')).toBe(0);
  });
});
