import { describe, expect, it, vi } from 'vitest';
import { readConfig } from '../src/config';
import { readProviderConfig } from '../src/providerConfig';
import { createRequestLimiter } from '../src/requestLimits';
import { createApiServer } from '../src/httpServer';
import type { GenerationProvider } from '../src/provider';
import { API_ERRORS } from '../src/errors';
import { createGroqProvider } from '../src/ai/groqProvider';
import { encodeGroqSelection } from '../src/ai/groqSelectionSchema';

const publicEnvironment = { API_PUBLIC_MODE: 'true', API_PROVIDER: 'groq', API_HOST: '0.0.0.0',
  API_CORS_ORIGINS: 'https://example.vercel.app', PORT: '10000' };
const selection = { version: 'selection-poc-2', form: { enabled: false, label: null }, unsupported: [],
  components: [{ type: 'text', props: { content: 'Example' } }] };
const providerConfig = readProviderConfig({ API_PROVIDER: 'groq', GROQ_API_KEY: 'test-only-key' });
if (providerConfig.provider !== 'groq') throw new Error('Expected Groq');
const groqConfig = providerConfig;

async function withApi(run: (url: string) => Promise<void>, environment: NodeJS.ProcessEnv = publicEnvironment, provider?: GenerationProvider) {
  const server = createApiServer({ config: readConfig(environment), logger: () => {},
    provider: provider ?? { id: 'groq-flat-selection', isMock: false, generate: vi.fn() } });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP');
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}
const post = (url: string) => fetch(`${url}/api/generate`, { method: 'POST', headers: {
  'Content-Type': 'application/json', Origin: 'https://example.vercel.app' }, body: JSON.stringify({ prompt: 'Example' }) });

describe('explicit public configuration and release gate', () => {
  it('honors Render PORT, uses one inference deadline and keeps generation closed by default', () => {
    expect(readConfig(publicEnvironment)).toMatchObject({ host: '0.0.0.0', port: 10000, publicMode: true,
      publicGenerationEnabled: false, generationTimeoutMs: 25000, requestTimeoutMs: 120000,
      rateLimit: { enabled: true, windowMs: 61000, max: 1, dailyMax: 20 } });
    expect(readConfig({ ...publicEnvironment, API_PORT: '3002' }).port).toBe(3002);
    expect(readConfig({ PORT: '10000' }).port).toBe(3001); // Render does not change local defaults.
  });
  it.each([
    { API_PUBLIC_MODE: 'yes' }, { API_PUBLIC_GENERATION_ENABLED: 'yes' }, { API_HOST: '0.0.0.0' },
    { ...publicEnvironment, API_PROVIDER: 'ollama' }, { ...publicEnvironment, API_PROVIDER: 'mock' },
    { ...publicEnvironment, API_CORS_ORIGINS: 'http://example.com' },
    { ...publicEnvironment, API_RATE_LIMIT_ENABLED: 'false' },
    { API_RATE_LIMIT_MAX: '0' }, { API_RATE_LIMIT_WINDOW_MS: '999' }, { API_DAILY_LIMIT_MAX: '1001' },
  ])('fails closed for unsafe settings %#', env => { expect(() => readConfig(env)).toThrow(); });
  it('requires a backend key, fixed supported model, and rejects a second inference timeout', () => {
    expect(() => readProviderConfig({ API_PROVIDER: 'groq' })).toThrow();
    expect(() => readProviderConfig({ API_PROVIDER: 'groq', GROQ_API_KEY: 'bad key' })).toThrow();
    expect(() => readProviderConfig({ API_PROVIDER: 'groq', GROQ_API_KEY: 'test', GROQ_MODEL: 'other' })).toThrow();
    expect(() => readProviderConfig({ API_PROVIDER: 'groq', GROQ_API_KEY: 'test', GROQ_TIMEOUT_MS: '1000' })).toThrow();
    expect(readProviderConfig({})).toEqual({ provider: 'mock' });
  });
  it('serves health but makes no inference call until explicitly enabled', async () => {
    const generate = vi.fn();
    await withApi(async url => {
      expect(await (await fetch(`${url}/api/health`)).json()).toMatchObject({ provider: 'groq-flat-selection' });
      const result = await post(url);
      expect(result.status).toBe(503);
      expect(await result.json()).toEqual({ error: { code: 'PUBLIC_GENERATION_DISABLED', message: API_ERRORS.PUBLIC_GENERATION_DISABLED.message }, requestId: expect.any(String) });
    }, publicEnvironment, { id: 'groq-flat-selection', isMock: false, generate });
    expect(generate).not.toHaveBeenCalled();
  });
});

describe('bounded per-process budgets', () => {
  it('enforces a full interval after a late first admission, including across old window boundaries', () => {
    let now = 0;
    const admit = createRequestLimiter({ enabled: true, windowMs: 61000, max: 1, dailyMax: 20 }, () => now);
    now = 60000; admit();
    now = 61000; expect(admit).toThrow(expect.objectContaining({ code: 'RATE_LIMITED', retryAfterSeconds: 60 }));
    now = 120999; expect(admit).toThrow(expect.objectContaining({ retryAfterSeconds: 1 }));
    now = 121000; expect(admit).not.toThrow();
  });
  it('does not reset the daily budget at a process-anchored day boundary', () => {
    let now = 0;
    const admit = createRequestLimiter({ enabled: true, windowMs: 61000, max: 1, dailyMax: 1 }, () => now);
    now = 86340000; admit();
    now = 86401000; expect(admit).toThrow(expect.objectContaining({ code: 'RATE_LIMITED', retryAfterSeconds: 86339 }));
    now = 86340000 + 86400000; expect(admit).not.toThrow();
  });
  it('enforces configurable multi-request rolling windows without extending rejected attempts', () => {
    let now = 0;
    const admit = createRequestLimiter({ enabled: true, windowMs: 61000, max: 2, dailyMax: 20 }, () => now);
    admit(); now = 1000; admit(); now = 60000;
    expect(admit).toThrow(expect.objectContaining({ retryAfterSeconds: 1 }));
    now = 61000; expect(admit).not.toThrow();
    expect(admit).toThrow(expect.objectContaining({ retryAfterSeconds: 1 }));
  });
  it('counts admitted failures and resets short and daily windows independently', () => {
    let now = 0;
    const admit = createRequestLimiter({ enabled: true, windowMs: 60000, max: 1, dailyMax: 2 }, () => now);
    admit(); expect(admit).toThrow(expect.objectContaining({ code: 'RATE_LIMITED', retryAfterSeconds: 60 }));
    now = 60000; admit();
    now = 120000; expect(admit).toThrow(expect.objectContaining({ code: 'RATE_LIMITED', retryAfterSeconds: 86280 }));
    now = 86400000; expect(admit).not.toThrow();
  });
  it('returns safe quota errors and Retry-After without consuming another provider call', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ choices: [
      { finish_reason: 'stop', message: { content: JSON.stringify(encodeGroqSelection(selection)) } },
    ] })));
    await withApi(async url => {
      const first = await post(url); expect(first.status).toBe(200);
      expect(await first.json()).toMatchObject({ meta: { provider: 'groq-flat-selection', isMock: false }, data: { specification: { version: '1.0' } } });
      const limited = await post(url); expect(limited.status).toBe(429);
      expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
      expect(await limited.json()).toMatchObject({ error: { code: 'RATE_LIMITED', message: API_ERRORS.RATE_LIMITED.message } });
    }, { ...publicEnvironment, API_PUBLIC_GENERATION_ENABLED: 'true' }, createGroqProvider(groqConfig, request));
    expect(request).toHaveBeenCalledTimes(1);
  });
  it.each([
    [429, 'RATE_LIMITED', 429], [401, 'PROVIDER_CONFIGURATION_ERROR', 503], [503, 'PROVIDER_UNAVAILABLE', 503],
  ] as const)('preserves the API envelope for upstream %s', async (status, code, expectedStatus) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response('PRIVATE provider details', { status, headers: { 'Retry-After': '5' } }));
    await withApi(async url => {
      const result = await post(url); expect(result.status).toBe(expectedStatus);
      const body = await result.json();
      expect(body).toEqual({ error: { code, message: API_ERRORS[code].message }, requestId: expect.any(String) });
      expect(JSON.stringify(body)).not.toContain('PRIVATE');
      if (status === 429) expect(result.headers.get('retry-after')).toBe('5');
    }, publicEnvironmentForGeneration(), createGroqProvider(groqConfig, request));
  });
});
function publicEnvironmentForGeneration() { return { ...publicEnvironment, API_PUBLIC_GENERATION_ENABLED: 'true' }; }
