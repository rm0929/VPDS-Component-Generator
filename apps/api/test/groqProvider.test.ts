import { createServer } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { createGroqProvider } from '../src/ai/groqProvider';
import { encodeGroqSelection, buildGroqSelectionSchema, groqSelectionMessages } from '../src/ai/groqSelectionSchema';
import { readProviderConfig } from '../src/providerConfig';
import { generateWithTimeout } from '../src/provider';
import { compileSelectionPoc } from '../src/ai/selection';
import * as compiler from '../src/ai/selection';
import { createGenerationDiagnostics } from '../src/diagnostics';

const config = readProviderConfig({ API_PROVIDER: 'groq', GROQ_API_KEY: 'test-only-key' });
if (config.provider !== 'groq') throw new Error('Expected Groq');
const groqConfig = config;
const selection = { version: 'selection-poc-2', form: { enabled: false, label: null }, unsupported: [],
  components: [{ type: 'switch', props: { label: 'Alerts', disabled: false, defaultChecked: false } }] };
const signal = () => new AbortController().signal;
const envelope = (content: unknown = encodeGroqSelection(selection), finish = 'stop') => ({ choices: [
  { finish_reason: finish, message: { content: JSON.stringify(content) } },
] });
const response = (body: unknown = envelope(), status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers });

describe('Groq HTTP provider, mocked only; no live inference', () => {
  it('uses one strict-schema HTTPS call with the API-owned signal, no independent timeout or retries', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response());
    const provider = createGroqProvider(groqConfig, request);
    const abortSignal = signal();
    expect(provider).toMatchObject({ id: 'groq-flat-selection', isMock: false });
    expect(provider.timeoutMs).toBeUndefined();
    expect(await provider.generate('PRIVATE-PROMPT', { signal: abortSignal })).toEqual(compileSelectionPoc(selection));
    expect(request).toHaveBeenCalledExactlyOnceWith('https://api.groq.com/openai/v1/chat/completions', expect.objectContaining({
      method: 'POST', redirect: 'error', signal: abortSignal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-only-key' },
    }));
    expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toEqual({
      model: 'openai/gpt-oss-20b', temperature: 0, reasoning_effort: 'low', stream: false, max_completion_tokens: 2048,
      messages: [...groqSelectionMessages(), { role: 'user', content: 'PRIVATE-PROMPT' }],
      response_format: { type: 'json_schema', json_schema: { name: 'ui_selection', strict: true, schema: buildGroqSelectionSchema() } },
    });
  });

  it.each([
    ['unsupported', () => response(envelope(encodeGroqSelection({ ...selection, components: [], unsupported: ['component'] }))), 'UNSUPPORTED_UI_REQUEST'],
    ['malformed wire selection', () => response(envelope(selection)), 'INVALID_PROVIDER_OUTPUT'],
    ['composition failure', () => response(envelope(encodeGroqSelection({ ...selection, components: [{ type: 'button', props: { label: 'Go', type: 'submit' } }] }))), 'INVALID_PROVIDER_OUTPUT'],
    ['invalid envelope', () => response({}), 'INVALID_PROVIDER_OUTPUT'],
    ['invalid HTTP JSON', () => new Response('PRIVATE'), 'INVALID_PROVIDER_OUTPUT'],
    ['invalid content JSON', () => response({ choices: [{ finish_reason: 'stop', message: { content: 'PRIVATE' } }] }), 'INVALID_PROVIDER_OUTPUT'],
    ['refusal', () => response({ choices: [{ finish_reason: 'stop', message: { content: null, refusal: 'PRIVATE' } }] }), 'INVALID_PROVIDER_OUTPUT'],
    ['truncation', () => response(envelope({}, 'length')), 'MODEL_OUTPUT_TRUNCATED'],
    ['declared oversized body', () => response(envelope(), 200, { 'Content-Length': '65537' }), 'PROVIDER_RESPONSE_TOO_LARGE'],
    ['streamed oversized body', () => new Response('x'.repeat(65537)), 'PROVIDER_RESPONSE_TOO_LARGE'],
    ['credentials', () => response({ secret: 'PRIVATE' }, 401), 'PROVIDER_CONFIGURATION_ERROR'],
    ['schema rejection', () => response({ secret: 'PRIVATE' }, 400), 'PROVIDER_CONFIGURATION_ERROR'],
    ['service unavailable', () => response({ secret: 'PRIVATE' }, 503), 'PROVIDER_UNAVAILABLE'],
    ['quota', () => response({}, 429, { 'Retry-After': '12' }), 'RATE_LIMITED'],
  ] as const)('maps %s safely and recovers its request guard', async (_name, makeResponse, code) => {
    const request = vi.fn<typeof fetch>().mockImplementationOnce(async () => makeResponse()).mockResolvedValueOnce(response());
    const sink = vi.fn();
    const provider = createGroqProvider(groqConfig, request, createGenerationDiagnostics({ NODE_ENV: 'development', API_LOCAL_DIAGNOSTICS: 'true' }, sink));
    await expect(provider.generate('PRIVATE-PROMPT', { signal: signal() })).rejects.toMatchObject({ code });
    expect(JSON.stringify(sink.mock.calls)).not.toContain('PRIVATE');
    expect(await provider.generate('Next', { signal: signal() })).toEqual(compileSelectionPoc(selection));
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('maps identifiable fetch failures only, preserving unexpected TypeErrors', async () => {
    const error = new TypeError('PRIVATE', { cause: { code: 'ECONNREFUSED' } });
    await expect(createGroqProvider(groqConfig, vi.fn<typeof fetch>().mockRejectedValue(error)).generate('Request', { signal: signal() }))
      .rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    const bug = new TypeError('PRIVATE processing bug');
    await expect(createGroqProvider(groqConfig, vi.fn<typeof fetch>().mockRejectedValue(bug)).generate('Request', { signal: signal() })).rejects.toBe(bug);
  });

  it.each([new Error('PRIVATE'), new TypeError('PRIVATE')])('does not misclassify compiler programming errors', async error => {
    const spy = vi.spyOn(compiler, 'compileSelectionPoc').mockImplementationOnce(() => { throw error; });
    try {
      await expect(createGroqProvider(groqConfig, vi.fn<typeof fetch>().mockResolvedValue(response())).generate('Request', { signal: signal() })).rejects.toBe(error);
    } finally { spy.mockRestore(); }
  });

  it.each(['timeout', 'disconnect'] as const)('cancels the actual HTTP signal on %s, enforces concurrency, and recovers', async kind => {
    let observed: AbortSignal | undefined;
    const request = vi.fn<typeof fetch>().mockImplementationOnce(async (_url, init) => new Promise((_resolve, reject) => {
      observed = init?.signal as AbortSignal;
      observed.addEventListener('abort', () => reject(observed!.reason), { once: true });
    })).mockResolvedValueOnce(response());
    const provider = createGroqProvider(groqConfig, request);
    const controller = new AbortController();
    const first = generateWithTimeout(provider, 'First', kind === 'timeout' ? 25 : 1000, controller.signal);
    const assertion = expect(first).rejects.toMatchObject({ code: kind === 'timeout' ? 'GENERATION_TIMEOUT' : 'PROVIDER_FAILURE' });
    await Promise.resolve(); // generateWithTimeout schedules the provider on a microtask.
    await expect(provider.generate('Concurrent', { signal: signal() })).rejects.toMatchObject({ code: 'GENERATION_BUSY' });
    if (kind === 'disconnect') controller.abort();
    await assertion;
    expect(observed?.aborted).toBe(true);
    await expect(provider.generate('Next', { signal: signal() })).resolves.toEqual(compileSelectionPoc(selection));
  });
});


describe('Groq transport lifecycle against a fake local HTTP server (not Groq inference)', () => {
  it.each(['timeout', 'disconnect'] as const)('aborts an actual held response on %s and releases the guard', async kind => {
    let started!: () => void; let closed!: () => void;
    const start = new Promise<void>(resolve => { started = resolve; });
    const close = new Promise<void>(resolve => { closed = resolve; });
    let calls = 0;
    const server = createServer((req, res) => {
      req.resume();
      req.once('end', () => {
        calls++;
        if (calls === 1) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.write('{"choices":[');
          res.once('close', closed); started();
        } else res.end(JSON.stringify(envelope()));
      });
    });
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Expected loopback');
      const provider = createGroqProvider(groqConfig, (_url, init) => fetch(`http://127.0.0.1:${address.port}`, init));
      const controller = new AbortController();
      const pending = generateWithTimeout(provider, 'Held', kind === 'timeout' ? 200 : 3000, controller.signal);
      const assertion = expect(pending).rejects.toMatchObject({ code: kind === 'timeout' ? 'GENERATION_TIMEOUT' : 'PROVIDER_FAILURE' });
      await start;
      if (kind === 'disconnect') controller.abort();
      await assertion; await close;
      await expect(provider.generate('Next', { signal: signal() })).resolves.toEqual(compileSelectionPoc(selection));
      expect(calls).toBe(2);
    } finally {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});
