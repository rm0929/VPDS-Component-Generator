import { describe, expect, it, vi } from 'vitest';
import { request as httpRequest } from 'node:http';
import { z } from 'zod';
import { uiSpecificationSchema } from '../../src/specification/uiSpecification';
import { createApiServer } from '../src/httpServer';
import type { AppOptions, ApiLogEntry } from '../src/app';
import { readConfig } from '../src/config';
import { API_ERRORS } from '../src/errors';
import type { ApiErrorCode } from '../src/errors';
import { MOCK_PROMPTS, mockProvider } from '../src/mockProvider';
import type { GenerationProvider } from '../src/provider';

const config = readConfig({});
const successSchema = z.strictObject({
  data: z.strictObject({ specification: uiSpecificationSchema }),
  meta: z.strictObject({ provider: z.string(), isMock: z.boolean() }), requestId: z.uuid(),
});

async function withApi(
  run: (url: string, logs: ApiLogEntry[]) => Promise<void>, options: AppOptions = {},
) {
  const logs: ApiLogEntry[] = [];
  const server = createApiServer({ config, logger: entry => logs.push(entry), ...options });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP address');
    await run(`http://127.0.0.1:${address.port}`, logs);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

function post(url: string, body: unknown) {
  return fetch(`${url}/api/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(3000),
  });
}

async function expectError(response: Response, code: ApiErrorCode) {
  expect(response.status).toBe(API_ERRORS[code].status);
  expect(response.headers.get('content-type')).toContain('application/json');
  const body = z.strictObject({ error: z.strictObject({ code: z.string(), message: z.string() }), requestId: z.uuid() }).parse(await response.json());
  expect(body).toEqual({ error: { code, message: API_ERRORS[code].message }, requestId: expect.any(String) });
  expect(body.requestId).toBe(response.headers.get('x-request-id'));
  return body;
}

function providerReturning(output: unknown): GenerationProvider {
  return { id: 'test-provider', isMock: true, async generate() { return output; } };
}

describe('API integration over real HTTP', () => {
  it('reports health, mock identity, no cache, and a server-generated request ID', async () => {
    await withApi(async (url, logs) => {
      const response = await fetch(`${url}/api/health`, { headers: { 'X-Request-ID': 'do-not-trust-client-content' } });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: 'ok', provider: 'deterministic-mock', isMock: true, requestId: response.headers.get('x-request-id') });
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('x-powered-by')).toBeNull();
      expect(response.headers.get('x-request-id')).not.toBe('do-not-trust-client-content');
      expect(logs).toHaveLength(1);
    });
  });

  it.each(MOCK_PROMPTS)('returns a schema-valid specification for the non-AI example %s', async prompt => {
    await withApi(async url => {
      const response = await post(url, { prompt });
      expect(response.status).toBe(200);
      const body = successSchema.parse(await response.json());
      expect(body.meta).toEqual({ provider: 'deterministic-mock', isMock: true });
      expect(body.requestId).toBe(response.headers.get('x-request-id'));
      expect(uiSpecificationSchema.safeParse(body.data.specification).success).toBe(true);
      expect(body.data.specification.root.id).toBe(prompt.includes('contact') ? 'contact-form' : 'registration-form');
    });
  });

  it('normalizes case and whitespace, returns fresh deterministic documents, and preserves the shared registration fixture', async () => {
    await withApi(async url => {
      const first = successSchema.parse(await (await post(url, { prompt: '  CREATE  A\n REGISTRATION FORM  ' })).json());
      const second = successSchema.parse(await (await post(url, { prompt: 'registration form' })).json());
      expect(first.data).toEqual(second.data);
      expect(first.requestId).not.toBe(second.requestId);
      const children = second.data.specification.root.children?.[0].children ?? [];
      expect(children.map((node: { id: string }) => node.id)).toEqual([
        'registration-title', 'name', 'email', 'password', 'confirm-password', 'terms', 'submit',
      ]);
    });
    const signal = new AbortController().signal;
    const first = await mockProvider.generate('registration form', { signal });
    const second = await mockProvider.generate('registration form', { signal });
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });

  it.each([{}, null, [], { prompt: '' }, { prompt: ' \n\t' }, { prompt: 123 }, { prompt: true },
    { prompt: 'x'.repeat(2001) }, { prompt: 'registration form', extra: 'not allowed' }])(
    'rejects invalid request %# before invoking the provider', async input => {
      const generate = vi.fn(async () => ({}));
      await withApi(async url => { await expectError(await post(url, input), 'INVALID_REQUEST'); }, {
        provider: { id: 'test', isMock: true, generate },
      });
      expect(generate).not.toHaveBeenCalled();
    },
  );

  it('accepts a 2000-character trimmed prompt but rejects longer prompts without echoing them', async () => {
    await withApi(async url => {
      await expectError(await post(url, { prompt: 'x'.repeat(2000) }), 'UNSUPPORTED_PROMPT');
      const body = await expectError(await post(url, { prompt: 'private-content-'.repeat(150) }), 'INVALID_REQUEST');
      expect(JSON.stringify(body)).not.toContain('private-content');
    });
  });

  it('rejects malformed or missing JSON without exposing parser details', async () => {
    await withApi(async url => {
      for (const body of ['{"prompt":"private-value"', '']) {
        const response = await fetch(`${url}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
        const output = await expectError(response, 'INVALID_REQUEST');
        expect(JSON.stringify(output)).not.toContain('private-value');
      }
    });
  });

  it('enforces the exact body-byte boundary including multibyte content', async () => {
    await withApi(async url => {
      const json = JSON.stringify({ prompt: 'registration form' });
      const exactBody = json + ' '.repeat(config.bodyLimitBytes - Buffer.byteLength(json));
      const response = await fetch(`${url}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: exactBody });
      expect(response.status).toBe(200);
      await response.json();
      for (const body of [exactBody + ' ', JSON.stringify({ prompt: '雪'.repeat(3000) })]) {
        await expectError(await fetch(`${url}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }), 'PAYLOAD_TOO_LARGE');
      }
    });
  });

  it('enforces the byte limit on chunked requests without a Content-Length header', async () => {
    await withApi(async url => {
      const response = await new Promise<{ status: number | undefined; body: unknown }>((resolve, reject) => {
        const request = httpRequest(`${url}/api/generate`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' },
        }, incoming => {
          let text = '';
          incoming.setEncoding('utf8');
          incoming.on('data', chunk => { text += chunk; });
          incoming.on('end', () => resolve({ status: incoming.statusCode, body: JSON.parse(text) }));
          incoming.on('error', reject);
        });
        request.on('error', reject);
        request.write('{"prompt":"');
        request.write('x'.repeat(config.bodyLimitBytes));
        request.end('"}');
      });
      expect(response.status).toBe(413);
      expect(response.body).toMatchObject({ error: { code: 'PAYLOAD_TOO_LARGE' } });
    });
  });

  it.each(['text/plain', 'application/x-www-form-urlencoded', 'application/json; charset=iso-8859-1'])(
    'rejects unsupported media/charset %s', async contentType => {
      await withApi(async url => {
        await expectError(await fetch(`${url}/api/generate`, {
          method: 'POST', headers: { 'Content-Type': contentType }, body: '{"prompt":"registration form"}',
        }), 'UNSUPPORTED_MEDIA_TYPE');
      });
    },
  );

  it('rejects compressed bodies rather than inflating unbounded data', async () => {
    await withApi(async url => {
      await expectError(await fetch(`${url}/api/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' }, body: 'not-inflated',
      }), 'UNSUPPORTED_MEDIA_TYPE');
    });
  });

  it('rejects unsupported mock requests without invoking AI or falling back to keyword generation', async () => {
    await withApi(async url => {
      await expectError(await post(url, { prompt: 'login with remember me' }), 'UNSUPPORTED_PROMPT');
    });
  });

  it('maps provider rejection to a generic stable error without exposing exception content', async () => {
    await withApi(async (url, logs) => {
      const body = await expectError(await post(url, { prompt: 'private-prompt' }), 'PROVIDER_FAILURE');
      expect(JSON.stringify({ body, logs })).not.toContain('provider-secret');
      expect(JSON.stringify({ body, logs })).not.toContain('private-prompt');
    }, { provider: { id: 'test', isMock: true, async generate() { throw new Error('provider-secret'); } } });
  });

  it.each([Error, TypeError])('returns a safe internal error for unexpected validator %s and permits another request', async ErrorType => {
    const validate = vi.spyOn(uiSpecificationSchema, 'safeParse').mockImplementationOnce(() => { throw new ErrorType('private-validator-secret'); });
    const diagnostics = vi.fn();
    try {
      await withApi(async (url, logs) => {
        const body = await expectError(await post(url, { prompt: 'private-prompt' }), 'INTERNAL_ERROR');
        expect(JSON.stringify({ body, logs, diagnostics: diagnostics.mock.calls })).not.toContain('private');
        expect(diagnostics).not.toHaveBeenCalled();
        const recovered = await post(url, { prompt: 'Next request' });
        expect(recovered.status).toBe(200);
        expect(successSchema.parse(await recovered.json()).data.specification.root.type).toBe('text');
        expect(logs.map(log => log.status)).toEqual([500, 200]);
      }, { diagnostics, provider: providerReturning({ version: '1.0', root: { id: 'root', type: 'text', props: { content: 'Example' } } }) });
    } finally { validate.mockRestore(); }
  });

  it('keeps unsuccessful specification validation distinct from exceptions and recovers', async () => {
    const valid = { version: '1.0', root: { id: 'root', type: 'text', props: { content: 'Example' } } };
    const generate = vi.fn().mockResolvedValueOnce({ version: '1.0', root: {} }).mockResolvedValue(valid);
    const diagnostics = vi.fn();
    await withApi(async (url, logs) => {
      await expectError(await post(url, { prompt: 'First request' }), 'INVALID_PROVIDER_OUTPUT');
      expect(diagnostics).toHaveBeenCalledWith('ui_schema', expect.any(Array));
      const recovered = await post(url, { prompt: 'Next request' });
      expect(recovered.status).toBe(200);
      expect(successSchema.parse(await recovered.json()).data.specification).toEqual(valid);
      expect(logs.map(log => log.status)).toEqual([502, 200]);
    }, { diagnostics, provider: { id: 'test', isMock: true, generate } });
  });

  it.each([
    undefined, null, {}, { version: '2.0', root: {} },
    { version: '1.0', root: { id: 'unsafe', type: 'script', props: {} } },
    { version: '1.0', root: { id: 'unsafe', type: 'text', props: { content: 'private-output', onClick: 'alert(1)' } } },
  ])('validates provider output and rejects invalid result %#', async output => {
    await withApi(async (url, logs) => {
      const body = await expectError(await post(url, { prompt: 'registration form' }), 'INVALID_PROVIDER_OUTPUT');
      expect(JSON.stringify({ body, logs })).not.toContain('private-output');
    }, { provider: providerReturning(output) });
  });

  it('handles cyclic provider output as an invalid specification', async () => {
    const cycle: { root?: unknown } = {};
    cycle.root = cycle;
    await withApi(async url => {
      await expectError(await post(url, { prompt: 'registration form' }), 'INVALID_PROVIDER_OUTPUT');
    }, { provider: providerReturning(cycle) });
  });

  it('times out a pending provider and signals cancellation', async () => {
    let signal: AbortSignal | undefined;
    await withApi(async url => {
      await expectError(await post(url, { prompt: 'registration form' }), 'GENERATION_TIMEOUT');
      expect(signal?.aborted).toBe(true);
    }, {
      config: { ...config, generationTimeoutMs: 15 },
      provider: { id: 'test', isMock: true, generate(_prompt, options) { signal = options.signal; return new Promise(() => {}); } },
    });
  });

  it('ignores a late rejection after timeout without a second response or unhandled rejection', async () => {
    await withApi(async (url, logs) => {
      await expectError(await post(url, { prompt: 'registration form' }), 'GENERATION_TIMEOUT');
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(logs).toHaveLength(1);
      expect(logs[0].errorCode).toBe('GENERATION_TIMEOUT');
    }, {
      config: { ...config, generationTimeoutMs: 10 },
      provider: { id: 'test', isMock: true, generate() { return new Promise((_resolve, reject) => setTimeout(() => reject(new Error('private-late-error')), 30)); } },
    });
  });

  it('signals provider cancellation when the client disconnects', async () => {
    let signal: AbortSignal | undefined;
    let notifyStarted = () => {};
    const started = new Promise<void>(resolve => { notifyStarted = resolve; });
    await withApi(async (url, logs) => {
      const controller = new AbortController();
      const response = fetch(`${url}/api/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'registration form' }), signal: controller.signal,
      }).catch(() => undefined);
      await started;
      controller.abort();
      await response;
      await new Promise(resolve => setTimeout(resolve, 30));
      expect(signal?.aborted).toBe(true);
      expect(logs).toHaveLength(1);
      expect(logs[0].status).toBe(499);
    }, { provider: { id: 'test', isMock: true, generate(_prompt, options) { signal = options.signal; notifyStarted(); return new Promise(() => {}); } } });
  });

  it('allows configured browser origins and preflight without credentials', async () => {
    await withApi(async url => {
      const response = await fetch(`${url}/api/health`, { headers: { Origin: 'http://localhost:5173' } });
      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
      expect(response.headers.get('access-control-allow-credentials')).toBeNull();
      expect(response.headers.get('vary')).toContain('Origin');
      const preflight = await fetch(`${url}/api/generate`, { method: 'OPTIONS', headers: {
        Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Content-Type',
      } });
      expect(preflight.status).toBe(204);
      expect(preflight.headers.get('access-control-allow-methods')).toContain('POST');
      expect(preflight.headers.get('access-control-allow-headers')).toBe('Content-Type');
    });
  });

  it('rejects unlisted origins instead of using wildcard CORS', async () => {
    await withApi(async url => {
      for (const origin of ['http://untrusted.example', 'null', 'http://localhost:5173.evil.example']) {
        const response = await fetch(`${url}/api/health`, { headers: { Origin: origin } });
        await expectError(response, 'CORS_ORIGIN_DENIED');
        expect(response.headers.get('access-control-allow-origin')).toBeNull();
      }
    });
  });

  it('returns JSON errors for unknown routes and unsupported endpoint methods', async () => {
    await withApi(async url => {
      await expectError(await fetch(`${url}/unknown?private=query`), 'NOT_FOUND');
      const method = await fetch(`${url}/api/generate`);
      await expectError(method, 'METHOD_NOT_ALLOWED');
      expect(method.headers.get('allow')).toBe('POST, OPTIONS');
    });
  });

  it('logs only allowlisted metadata, never request bodies, paths, queries, headers, or errors', async () => {
    await withApi(async (url, logs) => {
      await expectError(await fetch(`${url}/private-path?prompt=private-query`, { headers: { Authorization: 'private-token' } }), 'NOT_FOUND');
      await expectError(await post(url, { prompt: 'private-body' }), 'UNSUPPORTED_PROMPT');
      expect(logs).toHaveLength(2);
      for (const entry of logs) {
        expect(Object.keys(entry).sort()).toEqual(['durationMs', 'errorCode', 'method', 'requestId', 'route', 'status']);
        expect(entry.durationMs).toBeGreaterThanOrEqual(0);
        expect(JSON.stringify(entry)).not.toContain('private-');
      }
      expect(logs[0].route).toBe('unmatched');
      expect(logs[1].route).toBe('/api/generate');
    });
  });

  it('continues responding if the injected logger fails', async () => {
    await withApi(async url => {
      expect((await fetch(`${url}/api/health`)).status).toBe(200);
    }, { logger() { throw new Error('logging failure'); } });
  });
});
