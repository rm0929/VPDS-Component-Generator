import { describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import { createOllamaProvider } from '../src/ollamaProvider';
import { readProviderConfig } from '../src/providerConfig';
import type { OllamaConfig } from '../src/providerConfig';
import { createApiServer } from '../src/httpServer';
import { readConfig } from '../src/config';
import type { ApiLogEntry } from '../src/app';
import { buildModelSchema, MODEL_EXAMPLE_REQUEST, MODEL_EXAMPLE_RESPONSE } from '../src/modelSchema';
import registrationDraft from '../src/fixtures/registration-draft.json';
import loginDraft from './fixtures/login-draft.json';
import { compileModelUi } from '../src/compileModelUi';
import { uiSpecificationSchema } from '../../src/specification/uiSpecification';
import { coverageCases } from '../evaluation/coverageCases';
import { evaluateCoverage } from '../src/requirementCoverage';
import { createGenerationDiagnostics } from '../src/diagnostics';
import type { GenerationDiagnostics } from '../src/diagnostics';
import duplicateLogin from './fixtures/login-duplicate-id.json';
import { compileSemanticUiPlan } from '../src/compileSemanticUiPlan';
import { profilePlan } from './fixtures/semantic-plans';
import { compileSelectionPoc } from '../evaluation/selection-poc/selection';
import * as selectionCompiler from '../evaluation/selection-poc/selection';

function config(overrides: Partial<OllamaConfig> = {}): OllamaConfig {
  const value = readProviderConfig({ API_PROVIDER: 'ollama' });
  if (value.provider !== 'ollama') throw new Error('Expected Ollama config');
  return { ...value, ...overrides };
}
const registration = compileModelUi(registrationDraft);
const flatSelection = { version: 'selection-poc-2', form: { enabled: true, label: 'Editor' }, unsupported: [], components: [
  { type: 'textInput', props: { label: 'First', required: false } },
  { type: 'textInput', props: { label: 'Second', disabled: false }, besidePrevious: true },
  { type: 'emailInput', props: { label: 'Email' } },
  { type: 'button', props: { label: 'Apply', type: 'submit' } },
] };
const draft = (root: unknown) => ({ irVersion: '1', status: 'supported', root });
const signal = () => new AbortController().signal;
const envelope = (content: unknown = registrationDraft) => ({ done: true, done_reason: 'stop',
  message: { role: 'assistant', content: JSON.stringify(content) } });
const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });

describe('Ollama provider with mocked HTTP responses (no real inference)', () => {
  it('uses the local chat API with a JSON Schema grammar, separated roles, and bounded options', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(envelope()));
    const provider = createOllamaProvider(config(), request);
    expect(await provider.generate('create a registration form', { signal: signal() })).toEqual(registration);
    expect(request).toHaveBeenCalledTimes(1);
    const [url, init] = request.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:11434/api/chat');
    expect(init).toMatchObject({ method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json' } });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ model: 'qwen3:4b-instruct', stream: false, think: false, keep_alive: '2m',
      options: { temperature: 0, seed: 0, num_ctx: 8192, num_predict: 2048 } });
    expect(body.format).toEqual(buildModelSchema());
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).not.toContain('create a registration form');
    expect(body.messages[1]).toEqual({ role: 'user', content: MODEL_EXAMPLE_REQUEST });
    expect(body.messages[2]).toEqual({ role: 'assistant', content: MODEL_EXAMPLE_RESPONSE });
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'create a registration form' });
    expect(body).not.toHaveProperty('tools');
  });

  it('passes configured model/context/output limits and does not keep conversation history', async () => {
    const request = vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse(envelope()));
    const provider = createOllamaProvider(config({ model: 'custom-local:v1', contextSize: 4096, maxOutputTokens: 512 }), request);
    await provider.generate('first private prompt', { signal: signal() });
    await provider.generate('second prompt', { signal: signal() });
    const body = JSON.parse(String(request.mock.calls[1][1]?.body));
    expect(body).toMatchObject({ model: 'custom-local:v1', options: { num_ctx: 4096, num_predict: 512 } });
    expect(JSON.stringify(body)).not.toContain('first private prompt');
    expect(body.messages).toHaveLength(4);
  });

  it('does not discard components or expand a model summary into a hardcoded answer', async () => {
    const collapsed = draft({ type: 'text', props: { content: 'Registration Form' } });
    const request = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(envelope(collapsed)));
    const prompt = coverageCases[0].prompt;
    expect(await createOllamaProvider(config(), request).generate(prompt, { signal: signal() })).toEqual(compileModelUi(collapsed));
    const body = JSON.parse(String(request.mock.calls[0][1]?.body));
    expect(body.model).toBe('qwen3:4b-instruct');
    expect(body.options.temperature).toBe(0);
    expect(body.format).toEqual(buildModelSchema());
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: prompt });
    expect(body.messages[0].content).not.toContain('Coverage checklist for this request:');
  });

  it('leaves non-form requests on the general grammar rather than forcing registration output', async () => {
    const text = draft({ type: 'text', props: { content: 'Hello' } });
    const request = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(envelope(text)));
    const provider = createOllamaProvider(config(), request);
    expect(await provider.generate('Show a greeting.', { signal: signal() })).toEqual(compileModelUi(text));
    const body = JSON.parse(String(request.mock.calls[0][1]?.body));
    expect(body.format).toEqual(buildModelSchema());
    expect(body.messages[0].content).not.toContain('Coverage checklist for this request:');
  });

  it('compiles the exact login request without model IDs or request-specific grammar', async () => {
    const prompt = coverageCases.find(item => item.id === 'simple-login')!.prompt;
    const request = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(envelope(loginDraft)));
    const output = await createOllamaProvider(config(), request).generate(prompt, { signal: signal() });
    expect(output).toEqual(compileModelUi(loginDraft));
    const body = JSON.parse(String(request.mock.calls[0][1]?.body));
    expect(body.format).toEqual(buildModelSchema());
    expect(body.format.definitions).not.toHaveProperty('requested-form');
    expect(body.model).toBe('qwen3:4b-instruct');
    expect(body.options.temperature).toBe(0);
    expect(evaluateCoverage(output, coverageCases.find(item => item.id === 'simple-login')!.expectation).passed).toBe(true);
  });

  it.each([
    ['ollama_response_json', 'private invalid HTTP JSON'],
    ['ollama_envelope', JSON.stringify({ done: false, message: { role: 'assistant', content: 'private-content' } })],
    ['model_json', JSON.stringify({ done: true, message: { role: 'assistant', content: 'private invalid model JSON' } })],
  ])('distinguishes %s failures without logging the response or parser error', async (stage, httpBody) => {
    const sink = vi.fn();
    const diagnose = createGenerationDiagnostics({ NODE_ENV: 'development', API_LOCAL_DIAGNOSTICS: 'true' }, sink);
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(httpBody));
    await expect(createOllamaProvider(config(), request, diagnose).generate('private prompt', { signal: signal() })).rejects.toThrow();
    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink.mock.calls[0][0].stage).toBe(stage);
    expect(JSON.stringify(sink.mock.calls)).not.toContain('private');
  });

  it.each(['Create a form with email, phone number, and submit.',
    'Create a form with email and submit in a horizontal layout.',
    'Create a horizontal form with email and submit.'])(
    'uses the same grammar even with unknown fields/layout wording: %s', async prompt => {
      const request = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(envelope()));
      await createOllamaProvider(config(), request).generate(prompt, { signal: signal() });
      expect(JSON.parse(String(request.mock.calls[0][1]?.body)).format).toEqual(buildModelSchema());
    },
  );

  it('maps connection failures safely without exposing error text', async () => {
    const request = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('private-prompt/internal-address', { cause: { code: 'ECONNREFUSED' } }));
    await expect(createOllamaProvider(config(), request).generate('private', { signal: signal() }))
      .rejects.toMatchObject({ code: 'OLLAMA_UNAVAILABLE', message: 'The local Ollama server is unavailable.' });
  });

  it.each([404, 400, 500, 307])('handles HTTP %s without logging or echoing Ollama error bodies', async status => {
    const response = new Response('private server diagnostics', { status });
    const request = vi.fn<typeof fetch>().mockResolvedValue(response);
    await expect(createOllamaProvider(config(), request).generate('private', { signal: signal() }))
      .rejects.toMatchObject({ code: status === 404 ? 'OLLAMA_MODEL_NOT_FOUND' : 'OLLAMA_REQUEST_FAILED' });
    expect(response.bodyUsed).toBe(true); // Error body was cancelled, not parsed.
    expect(request).toHaveBeenCalledTimes(1); // No unconstrained retry or mock fallback.
  });

  it.each(['not json', '{', '```json\n{}\n```'])('rejects non-JSON HTTP envelopes %j', body => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(body));
    return expect(createOllamaProvider(config(), request).generate('form', { signal: signal() })).rejects.toMatchObject({ code: 'INVALID_MODEL_JSON' });
  });

  it.each(['not json', '{', '```json\n{}\n```', '<script>alert(1)</script>'])(
    'rejects non-JSON model content without attempting to repair/execute it %#', content => {
      const request = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ done: true, message: { role: 'assistant', content } }));
      return expect(createOllamaProvider(config(), request).generate('form', { signal: signal() })).rejects.toMatchObject({ code: 'INVALID_MODEL_JSON' });
    },
  );

  it.each([{}, { done: false, message: { role: 'assistant', content: '{}' } },
    { done: true, message: { role: 'user', content: '{}' } }, { done: true, message: { role: 'assistant', content: '' } }])(
    'rejects invalid or unfinished Ollama envelopes %#', body => {
      const request = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(body));
      return expect(createOllamaProvider(config(), request).generate('form', { signal: signal() })).rejects.toMatchObject({ code: 'INVALID_PROVIDER_OUTPUT' });
    },
  );

  it('rejects token-truncated output even if the partial content happens to parse', () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ ...envelope(), done_reason: 'length' }));
    return expect(createOllamaProvider(config(), request).generate('form', { signal: signal() })).rejects.toMatchObject({ code: 'MODEL_OUTPUT_TRUNCATED' });
  });

  it('bounds Content-Length and actual streamed bytes before JSON parsing, cancelling unread data', async () => {
    const declared = new Response('{}', { headers: { 'Content-Length': '5000' } });
    const request = vi.fn<typeof fetch>().mockResolvedValue(declared);
    await expect(createOllamaProvider(config({ responseLimitBytes: 4096 }), request).generate('form', { signal: signal() }))
      .rejects.toMatchObject({ code: 'PROVIDER_RESPONSE_TOO_LARGE' });
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array(3000)); controller.enqueue(new Uint8Array(3000)); },
      cancel() { cancelled = true; },
    });
    const streamingRequest = vi.fn<typeof fetch>().mockResolvedValue(new Response(stream));
    await expect(createOllamaProvider(config({ responseLimitBytes: 4096 }), streamingRequest).generate('form', { signal: signal() }))
      .rejects.toMatchObject({ code: 'PROVIDER_RESPONSE_TOO_LARGE' });
    expect(cancelled).toBe(true);
  });

  it('rejects invalid UTF-8 rather than silently replacing text bytes', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(new Uint8Array([0xff, 0xfe])));
    await expect(createOllamaProvider(config(), request).generate('form', { signal: signal() })).rejects.toMatchObject({ code: 'INVALID_MODEL_JSON' });
  });

  it.each(['draft', 'semantic-plan', 'flat-selection'] as const)('rejects an already-aborted %s signal without making an HTTP call', async workflow => {
    const controller = new AbortController();
    controller.abort();
    const request = vi.fn<typeof fetch>();
    await expect(createOllamaProvider(config({ workflow }), request).generate('form', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(request).not.toHaveBeenCalled();
  });

  it.each(['draft', 'flat-selection'] as const)('aborts a pending %s HTTP call on its own deadline, then permits another request', async workflow => {
    let aborted = false;
    const request = vi.fn<typeof fetch>().mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => { aborted = true; reject(init.signal?.reason); }, { once: true });
    })).mockImplementationOnce(async () => jsonResponse(envelope(workflow === 'flat-selection' ? flatSelection : registrationDraft)));
    const provider = createOllamaProvider(config({ timeoutMs: 15, workflow }), request);
    await expect(provider.generate('form', { signal: signal() })).rejects.toMatchObject({ code: 'GENERATION_TIMEOUT' });
    expect(aborted).toBe(true);
    expect(await provider.generate('form', { signal: signal() })).toEqual(workflow === 'flat-selection' ? compileSelectionPoc(flatSelection) : registration);
  });

  it('rejects concurrent generation instead of queueing prompts or increasing memory pressure', async () => {
    let finish: (response: Response) => void = () => {};
    const request = vi.fn<typeof fetch>().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const provider = createOllamaProvider(config(), request);
    const first = provider.generate('first', { signal: signal() });
    await expect(provider.generate('second', { signal: signal() })).rejects.toMatchObject({ code: 'GENERATION_BUSY' });
    finish(jsonResponse(envelope()));
    await first;
    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe('API validation and actual HTTP cancellation against a fake Ollama server', () => {
  async function withFakeOllama(run: (url: string, logs: ApiLogEntry[], disconnected: Promise<void>, started: Promise<void>) => Promise<void>, content?: unknown, stall = false, diagnostics?: GenerationDiagnostics, workflow: OllamaConfig['workflow'] = 'draft', dropConnection = false) {
    let onDisconnect = () => {};
    let onStarted = () => {};
    const disconnected = new Promise<void>(resolve => { onDisconnect = resolve; });
    const started = new Promise<void>(resolve => { onStarted = resolve; });
    const fakeOllama = createServer((req, res) => {
      onStarted();
      if (dropConnection) { req.socket.destroy(); return; }
      if (stall) {
        res.once('close', onDisconnect);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.write('{"message":'); // Headers arrived, but the response body never finishes.
      } else res.setHeader('Content-Type', 'application/json').end(JSON.stringify(envelope(content)));
    });
    await new Promise<void>((resolve, reject) => { fakeOllama.once('error', reject); fakeOllama.listen(0, '127.0.0.1', resolve); });
    const address = fakeOllama.address();
    if (!address || typeof address === 'string') throw new Error('Expected fake Ollama port');
    const logs: ApiLogEntry[] = [];
    const api = createApiServer({ config: readConfig({}), logger: entry => logs.push(entry), diagnostics,
      provider: createOllamaProvider(config({ baseUrl: `http://127.0.0.1:${address.port}`, timeoutMs: 200, workflow }), fetch, diagnostics),
    });
    try {
      await new Promise<void>((resolve, reject) => { api.once('error', reject); api.listen(0, '127.0.0.1', resolve); });
      const apiAddress = api.address();
      if (!apiAddress || typeof apiAddress === 'string') throw new Error('Expected API port');
      await run(`http://127.0.0.1:${apiAddress.port}`, logs, disconnected, started);
    } finally {
      api.closeAllConnections(); fakeOllama.closeAllConnections();
      await Promise.all([new Promise<void>(resolve => api.close(() => resolve())), new Promise<void>(resolve => fakeOllama.close(() => resolve()))]);
    }
  }
  const post = (url: string, signal?: AbortSignal, prompt = 'private natural-language prompt') => fetch(`${url}/api/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }), signal,
  });
  async function expectDisconnect(disconnected: Promise<void>) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([disconnected, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Downstream HTTP connection was not cancelled')), 1000);
      })]);
    } finally { clearTimeout(timer); }
  }

  it('returns a valid spec with non-mock metadata through the unchanged API envelope', () => withFakeOllama(async url => {
    const response = await post(url);
    expect(response.status).toBe(200);
    const body = await response.json() as { data: { specification: unknown }; meta: unknown };
    expect(uiSpecificationSchema.parse(body.data.specification)).toEqual(registration);
    expect(body.meta).toEqual({ provider: 'ollama-local', isMock: false });
  }));

  it('returns compiled semantic UI in the same API contract and identifies the selected workflow', () => withFakeOllama(async (url, logs) => {
    const health = await fetch(`${url}/api/health`);
    expect(await health.json()).toMatchObject({ status: 'ok', provider: 'ollama-local-semantic-plan', isMock: false });
    const response = await post(url);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ data: { specification: compileSemanticUiPlan(profilePlan()) },
      meta: { provider: 'ollama-local-semantic-plan', isMock: false }, requestId: expect.any(String) });
    expect(JSON.stringify(logs)).not.toContain('private');
    expect(JSON.stringify(logs)).not.toContain('Save Profile');
  }, profilePlan(), false, undefined, 'semantic-plan'));

  it('returns a compiled flat selection through the unchanged API envelope and health endpoint', () => withFakeOllama(async (url, logs) => {
    expect(await (await fetch(`${url}/api/health`)).json())
      .toMatchObject({ status: 'ok', provider: 'ollama-local-flat-selection', isMock: false });
    const response = await post(url);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { specification: compileSelectionPoc(flatSelection) },
      meta: { provider: 'ollama-local-flat-selection', isMock: false }, requestId: expect.any(String) });
    expect(JSON.stringify(logs)).not.toContain('private');
    expect(JSON.stringify(logs)).not.toContain('Editor');
  }, flatSelection, false, undefined, 'flat-selection'));

  it.each([Error, TypeError])('returns a safe provider failure for compiler %s after successful HTTP, then recovers', async ErrorType => {
    const original = selectionCompiler.compileSelectionPoc;
    const compiler = vi.spyOn(selectionCompiler, 'compileSelectionPoc')
      .mockImplementationOnce(() => { throw new ErrorType('private-compiler-secret'); });
    const diagnose = vi.fn();
    try {
      await withFakeOllama(async (url, logs) => {
        const response = await post(url);
        expect(response.status).toBe(502);
        const body = await response.json();
        expect(body).toEqual({ error: { code: 'PROVIDER_FAILURE', message: 'The generation provider failed.' }, requestId: expect.any(String) });
        expect(body).toMatchObject({ requestId: response.headers.get('x-request-id') });
        expect(JSON.stringify({ body, logs })).not.toContain('private');
        expect(diagnose).not.toHaveBeenCalled();
        const recovered = await post(url);
        expect(recovered.status).toBe(200);
        expect(await recovered.json()).toMatchObject({ data: { specification: original(flatSelection) } });
        expect(logs.map(log => log.status)).toEqual([502, 200]);
      }, flatSelection, false, diagnose, 'flat-selection');
    } finally { compiler.mockRestore(); }
  });

  it('returns the existing safe availability response for a real downstream socket failure', () => withFakeOllama(async (url, logs) => {
    const response = await post(url);
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual({ error: { code: 'OLLAMA_UNAVAILABLE', message: 'The local Ollama server is unavailable.' }, requestId: expect.any(String) });
    expect(body).toMatchObject({ requestId: response.headers.get('x-request-id') });
    expect(JSON.stringify({ body, logs })).not.toContain('private');
  }, undefined, false, undefined, 'flat-selection', true));

  it.each(['component', 'property', 'behavior', 'composition'])('returns the existing 422 response for flat unsupported %s', category =>
    withFakeOllama(async url => {
      const response = await post(url);
      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({ error: { code: 'UNSUPPORTED_UI_REQUEST',
        message: 'The request requires UI components or behavior outside the supported UI draft contract.' }, requestId: expect.any(String) });
    }, { ...flatSelection, components: [], unsupported: [category] }, false, undefined, 'flat-selection'));

  it.each([
    { ...flatSelection, components: [{ type: 'select', props: { label: 'private-value' } }] },
    { ...flatSelection, unsupported: ['behavior', 'behavior'] },
    { ...flatSelection, components: [] },
  ])('returns 502 for invalid flat selections without echoing model data %#', selection => withFakeOllama(async (url, logs) => {
    const response = await post(url);
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: { code: 'INVALID_PROVIDER_OUTPUT',
      message: 'The provider returned an invalid UI specification.' }, requestId: expect.any(String) });
    expect(JSON.stringify(logs)).not.toContain('private');
  }, selection, false, undefined, 'flat-selection'));

  it.each(['submit', 'reset'])('returns 502 and a safe composition path for flat %s outside a form', type => {
    const sink = vi.fn();
    const diagnostics = createGenerationDiagnostics({ NODE_ENV: 'development', API_LOCAL_DIAGNOSTICS: 'true' }, sink);
    return withFakeOllama(async url => {
      const response = await post(url);
      expect(response.status).toBe(502);
      expect(await response.json()).toMatchObject({ error: { code: 'INVALID_PROVIDER_OUTPUT' } });
      expect(sink.mock.calls[0][0]).toMatchObject({ stage: 'composition', issues: [
        { path: ['components', 0, 'props', 'type'], code: 'custom', message: 'Submit/reset buttons require a declared form.' },
      ] });
      expect(JSON.stringify(sink.mock.calls)).not.toContain('private');
    }, { ...flatSelection, form: { enabled: false, label: null },
      components: [{ type: 'button', props: { label: 'private-value', type } }] }, false, diagnostics, 'flat-selection');
  });

  it('maps semantic reference failures to the existing safe API error contract', () => {
    const invalid = profilePlan();
    invalid.groups[1].members[0] = { element: 99 };
    const sink = vi.fn();
    const diagnostics = createGenerationDiagnostics({ NODE_ENV: 'development', API_LOCAL_DIAGNOSTICS: 'true' }, sink);
    return withFakeOllama(async (url, logs) => {
      const response = await post(url);
      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({ error: { code: 'INVALID_PROVIDER_OUTPUT',
        message: 'The provider returned an invalid UI specification.' }, requestId: expect.any(String) });
      expect(sink.mock.calls[0][0]).toMatchObject({ stage: 'semantic_plan', issues: [
        { path: ['groups', 1, 'members', 0, 'element'], code: 'custom' },
      ] });
      expect(JSON.stringify([logs, sink.mock.calls])).not.toContain('private');
      expect(JSON.stringify([logs, sink.mock.calls])).not.toContain('Save Profile');
    }, invalid, false, diagnostics, 'semantic-plan');
  });

  it.each(['unsupported-component', 'unsupported-behavior'])(
    'maps semantic %s outcomes to the existing unsupported API response', reason => withFakeOllama(async url => {
      const response = await post(url);
      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body).toMatchObject({ error: { code: 'UNSUPPORTED_UI_REQUEST' }, requestId: expect.any(String) });
      expect(body).not.toHaveProperty('data');
      expect(body).not.toHaveProperty('reason');
    }, { planVersion: '1', status: 'unsupported', reason }, false, undefined, 'semantic-plan'),
  );

  it.each(['semantic-plan', 'flat-selection'] as const)('cancels %s HTTP response streaming on timeout', workflow => withFakeOllama(async (url, _logs, disconnected) => {
    const response = await post(url);
    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ error: { code: 'GENERATION_TIMEOUT' } });
    await expectDisconnect(disconnected);
  }, undefined, true, undefined, workflow));

  it.each(['semantic-plan', 'flat-selection'] as const)('cancels %s HTTP streaming when the caller disconnects', workflow => withFakeOllama(async (url, _logs, disconnected, started) => {
    const controller = new AbortController();
    const pending = post(url, controller.signal).catch(() => undefined);
    await started;
    controller.abort();
    await pending;
    await expectDisconnect(disconnected);
  }, undefined, true, undefined, workflow));

  it('returns the complete registration tree unchanged for the full request', () => withFakeOllama(async url => {
    const response = await post(url, undefined, coverageCases[0].prompt);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { specification: registration } });
  }));

  it('rejects legacy model IDs instead of stripping them, preserving the duplicate-ID regression', () => {
    const sink = vi.fn();
    const diagnostics = createGenerationDiagnostics({ NODE_ENV: 'development', API_LOCAL_DIAGNOSTICS: 'true' }, sink);
    const old = uiSpecificationSchema.safeParse(duplicateLogin);
    if (old.success) throw new Error('Expected duplicate-ID fixture to remain invalid');
    expect(old.error.issues).toMatchObject([{ path: ['root', 'children', 0, 'id'], code: 'custom' }]);
    return withFakeOllama(async url => {
      const response = await post(url, undefined, coverageCases.find(item => item.id === 'simple-login')!.prompt);
      expect(response.status).toBe(502);
      const body = await response.json();
      expect(body).toMatchObject({ error: { code: 'INVALID_PROVIDER_OUTPUT' } });
      expect(body).not.toHaveProperty('issues');
      expect(sink).toHaveBeenCalledTimes(1);
      expect(sink.mock.calls[0][0].stage).toBe('model_draft');
      expect(JSON.stringify(sink.mock.calls)).not.toContain('login-form');
    }, duplicateLogin, false, diagnostics);
  });

  it('returns a compiled valid login document with deterministic technical identity', () => {
    return withFakeOllama(async url => {
      const response = await post(url, undefined, coverageCases.find(item => item.id === 'simple-login')!.prompt);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ data: { specification: compileModelUi(loginDraft) } });
    }, loginDraft);
  });

  it('continues rejecting optional null values and reports their safe issue path', () => {
    const invalid = structuredClone(loginDraft);
    Object.assign(invalid.root.children[0].props, { disabled: null });
    const sink = vi.fn();
    const diagnostics = createGenerationDiagnostics({ NODE_ENV: 'development', API_LOCAL_DIAGNOSTICS: 'true' }, sink);
    return withFakeOllama(async url => {
      const response = await post(url, undefined, coverageCases.find(item => item.id === 'simple-login')!.prompt);
      expect(response.status).toBe(502);
      expect(await response.json()).toMatchObject({ error: { code: 'INVALID_PROVIDER_OUTPUT' } });
      expect(sink.mock.calls[0][0]).toMatchObject({ stage: 'model_draft', issues: [
        { path: ['root', 'children', 0, 'props', 'disabled'], code: 'invalid_type' },
      ] });
    }, invalid, false, diagnostics);
  });

  it('returns a valid text summary while the independent evaluator reports missing requirements', () => withFakeOllama(async (url, logs) => {
    const response = await post(url, undefined, coverageCases[0].prompt);
    expect(response.status).toBe(200);
    const body = await response.json() as { data: { specification: unknown } };
    expect(evaluateCoverage(body.data.specification, coverageCases[0].expectation)).toMatchObject({ schemaValid: true, passed: false, coverage: 0 });
    expect(logs[0].errorCode).toBeUndefined();
    expect(JSON.stringify(logs)).not.toContain(coverageCases[0].prompt);
    expect(JSON.stringify(logs)).not.toContain('Registration Form');
  }, draft({ type: 'text', props: { content: 'Registration Form' } })));

  it('does not use an incomplete keyword recognizer to reject a valid but incomplete form', () => {
    const incomplete = structuredClone(registrationDraft);
    incomplete.root.children[0].children = incomplete.root.children[0].children.filter(item => item.props.label !== 'Confirm password');
    return withFakeOllama(async url => {
      const response = await post(url, undefined, coverageCases[0].prompt);
      expect(response.status).toBe(200);
      const body = await response.json() as { data: { specification: unknown } };
      expect(evaluateCoverage(body.data.specification, coverageCases[0].expectation).missing).toEqual(['confirm-password']);
    }, incomplete);
  });

  it.each([
    { version: '2.0', root: {} },
    { version: '1.0', root: { id: 'script', type: 'script', props: {} } },
    { version: '1.0', root: { id: 'text', type: 'text', props: { content: 'private-output', onClick: 'alert(1)' } } },
    { version: '1.0', root: { id: 'registration-form', type: 'form', props: { label: 'Create an account' },
      children: [{ id: 'registration-form', type: 'button', props: { label: 'Create an account', type: 'button' } }] } },
  ])('rejects schema-invalid model output and protects log contents %#', content => withFakeOllama(async (url, logs) => {
    const response = await post(url);
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: { code: 'INVALID_PROVIDER_OUTPUT' } });
    expect(JSON.stringify(logs)).not.toContain('private');
  }, content));

  it('cancels the real fetch response body on timeout, not only the API Promise race', () => withFakeOllama(async (url, _logs, disconnected) => {
    const response = await post(url);
    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ error: { code: 'GENERATION_TIMEOUT' } });
    await expectDisconnect(disconnected);
  }, undefined, true));

  it('cancels the actual downstream HTTP call when the API caller disconnects', () => withFakeOllama(async (url, _logs, disconnected, started) => {
    const controller = new AbortController();
    const response = post(url, controller.signal).catch(() => undefined);
    await started;
    controller.abort();
    await response;
    await expectDisconnect(disconnected);
  }, undefined, true));

  it.each(['unsupported-component', 'unsupported-behavior'])(
    'returns a safe explicit unsupported outcome for %s without changing success responses', reason => {
      const sink = vi.fn();
      const diagnostics = createGenerationDiagnostics({ NODE_ENV: 'development', API_LOCAL_DIAGNOSTICS: 'true' }, sink);
      return withFakeOllama(async (url, logs) => {
        const response = await post(url);
        expect(response.status).toBe(422);
        const body = await response.json();
        expect(body).toMatchObject({ error: { code: 'UNSUPPORTED_UI_REQUEST' }, requestId: expect.any(String) });
        expect(body).not.toHaveProperty('data');
        expect(body).not.toHaveProperty('reason');
        expect(sink.mock.calls[0][0]).toMatchObject({ stage: 'unsupported_request', issues: [] });
        expect(logs[0].errorCode).toBe('UNSUPPORTED_UI_REQUEST');
      }, { irVersion: '1', status: 'unsupported', reason }, false, diagnostics);
    },
  );

  it.each([
    { irVersion: '1', status: 'unsupported', reason: 'private model explanation' },
    { irVersion: '1', status: 'unsupported', reason: 'unsupported-component', message: 'private' },
    { irVersion: '1', status: 'unsupported', reason: 'unsupported-component', root: { type: 'text', props: { content: 'private' } } },
  ])('rejects malformed unsupported responses instead of echoing them %#', content => withFakeOllama(async (url, logs) => {
    const response = await post(url);
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body).toMatchObject({ error: { code: 'INVALID_PROVIDER_OUTPUT' } });
    expect(JSON.stringify([body, logs])).not.toContain('private');
  }, content));

  it('rejects invalid form ancestry after identity assignment and emits only safe final-schema issues', () => {
    const sink = vi.fn();
    const diagnostics = createGenerationDiagnostics({ NODE_ENV: 'development', API_LOCAL_DIAGNOSTICS: 'true' }, sink);
    return withFakeOllama(async url => {
      const response = await post(url);
      expect(response.status).toBe(502);
      expect(await response.json()).toMatchObject({ error: { code: 'INVALID_PROVIDER_OUTPUT' } });
      expect(sink).toHaveBeenCalledExactlyOnceWith({ stage: 'ui_schema', message: 'The model document failed authoritative UI validation.',
        issues: [{ path: ['root'], code: 'custom', message: 'Submit/reset buttons require a form ancestor.' }],
      });
      expect(JSON.stringify(sink.mock.calls)).not.toContain('private label');
    }, draft({ type: 'button', props: { label: 'private label', type: 'submit' } }), false, diagnostics);
  });

  it('does not force a model-selected ordinary Login button into submit behavior', () => {
    const input = structuredClone(loginDraft);
    input.root.children[2].props.type = 'button';
    return withFakeOllama(async url => {
      const response = await post(url, undefined, coverageCases.find(item => item.id === 'simple-login')!.prompt);
      expect(response.status).toBe(200);
      const body = await response.json() as { data: { specification: unknown } };
      expect(body.data.specification).toEqual(compileModelUi(input));
      expect(evaluateCoverage(body.data.specification, coverageCases.find(item => item.id === 'simple-login')!.expectation).missing).toEqual(['login']);
    }, input);
  });

  it('uses byte-identical system instructions and format for form, layout, and unknown wording', async () => {
    const request = vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse(envelope()));
    const provider = createOllamaProvider(config(), request);
    for (const prompt of ['Create a simple login form.', 'Arrange horizontal text.', 'Unknown custom request.']) {
      await provider.generate(prompt, { signal: signal() });
    }
    const bodies = request.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
    for (const body of bodies) {
      expect(body.format).toEqual(bodies[0].format);
      expect(body.messages[0]).toEqual(bodies[0].messages[0]);
    }
  });
});
