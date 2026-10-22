import { describe, expect, it, vi } from 'vitest';
import { createOllamaProvider } from '../src/ollamaProvider';
import { readProviderConfig } from '../src/providerConfig';
import type { OllamaConfig } from '../src/providerConfig';
import { createGenerationDiagnostics } from '../src/diagnostics';
import { buildSelectionModelSchema, selectionMessages } from '../evaluation/selection-poc/model';
import { compileSelectionPoc } from '../evaluation/selection-poc/selection';
import * as selectionCompiler from '../evaluation/selection-poc/selection';

// The runtime import graph must not pull in evaluation runners or filesystem I/O.
vi.mock('node:fs', () => { throw new Error('Runtime generation must not import filesystem modules.'); });
vi.mock('../evaluation/selection-poc/runFeasibility', () => { throw new Error('Runtime generation must not import the benchmark runner.'); });
vi.mock('../evaluation/selection-poc/ollama', () => { throw new Error('Use the production transport, not the manual PoC HTTP helper.'); });

const config = (overrides: Partial<OllamaConfig> = {}): OllamaConfig => {
  const value = readProviderConfig({ API_PROVIDER: 'ollama', OLLAMA_WORKFLOW: 'flat-selection' });
  if (value.provider !== 'ollama') throw new Error('Expected Ollama configuration');
  return { ...value, ...overrides };
};
const signal = () => new AbortController().signal;
const selected = {
  version: 'selection-poc-2', form: { enabled: true, label: null }, unsupported: [], components: [
    { type: 'heading', props: { content: 'Editor', level: 2 } },
    { type: 'text', props: { content: 'Review entries' } },
    { type: 'textInput', props: { label: 'Name', required: false } },
    { type: 'emailInput', props: { label: 'Email', placeholder: 'you@example.com' }, besidePrevious: true },
    { type: 'passwordInput', props: { label: 'Secret', disabled: true, maxLength: 72 } },
    { type: 'checkbox', props: { label: 'Updates', required: false, disabled: false } },
    { type: 'button', props: { label: 'Apply', type: 'submit' } },
  ],
};
const response = (selection: unknown = selected) => new Response(JSON.stringify({
  done: true, done_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(selection) },
}));

describe('production flat-selection workflow with mocked HTTP (no inference)', () => {
  it('uses the current flat grammar/messages and pure composer through one production request', async () => {
    const request = vi.fn<typeof fetch>().mockImplementation(async () => response());
    const provider = createOllamaProvider(config(), request);
    expect(provider).toMatchObject({ id: 'ollama-local-flat-selection', isMock: false, timeoutMs: 60000 });
    expect(request).not.toHaveBeenCalled();
    expect(await provider.generate('Developer-owned request', { signal: signal() })).toEqual(compileSelectionPoc(selected));
    expect(request).toHaveBeenCalledTimes(1);
    const [url, init] = request.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:11434/api/chat');
    expect(init).toMatchObject({ method: 'POST', redirect: 'error', signal: expect.any(AbortSignal) });
    expect(JSON.parse(String(init?.body))).toEqual({
      model: 'qwen3:4b-instruct', stream: false, think: false, keep_alive: '2m',
      format: buildSelectionModelSchema(), messages: [...selectionMessages(), { role: 'user', content: 'Developer-owned request' }],
      options: { temperature: 0, seed: 0, num_ctx: 8192, num_predict: 2048 },
    });
  });

  it('preserves overrides and does not retain prior prompts', async () => {
    const request = vi.fn<typeof fetch>().mockImplementation(async () => response());
    const provider = createOllamaProvider(config({ contextSize: 4096, maxOutputTokens: 512 }), request);
    await provider.generate('PRIVATE-FIRST', { signal: signal() });
    await provider.generate('Second request', { signal: signal() });
    const body = JSON.parse(String(request.mock.calls[1][1]?.body));
    expect(body.options).toEqual({ temperature: 0, seed: 0, num_ctx: 4096, num_predict: 512 });
    expect(body.messages).toEqual([...selectionMessages(), { role: 'user', content: 'Second request' }]);
    expect(JSON.stringify(body)).not.toContain('PRIVATE-FIRST');
  });

  it.each([
    { stage: 'selection_schema', selection: { ...selected, components: [{ type: 'select', props: { label: 'PRIVATE' } }] } },
    { stage: 'selection_schema', selection: { ...selected, form: { enabled: false, label: 'PRIVATE' } } },
    { stage: 'selection_schema', selection: { ...selected, unsupported: ['behavior', 'behavior'] } },
    { stage: 'composition', selection: { ...selected, form: { enabled: false, label: null } } },
  ])('maps $stage to invalid output without retrying or logging values', async ({ stage, selection }) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response(selection));
    const sink = vi.fn();
    const provider = createOllamaProvider(config(), request,
      createGenerationDiagnostics({ NODE_ENV: 'development', API_LOCAL_DIAGNOSTICS: 'true' }, sink));
    await expect(provider.generate('PRIVATE-PROMPT', { signal: signal() })).rejects.toMatchObject({ code: 'INVALID_PROVIDER_OUTPUT' });
    expect(sink.mock.calls[0][0].stage).toBe(stage);
    expect(JSON.stringify(sink.mock.calls)).not.toContain('PRIVATE');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each(['component', 'property', 'behavior', 'composition'])('maps explicit unsupported %s to the existing API code', async category => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response({ ...selected, components: [], unsupported: [category] }));
    const diagnose = vi.fn();
    await expect(createOllamaProvider(config(), request, diagnose).generate('Request', { signal: signal() }))
      .rejects.toMatchObject({ code: 'UNSUPPORTED_UI_REQUEST' });
    expect(diagnose).toHaveBeenCalledWith('unsupported_request', []);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['http JSON', () => new Response('PRIVATE'), 'INVALID_MODEL_JSON'],
    ['envelope', () => new Response('{}'), 'INVALID_PROVIDER_OUTPUT'],
    ['model JSON', () => new Response(JSON.stringify({ done: true, message: { role: 'assistant', content: 'PRIVATE' } })), 'INVALID_MODEL_JSON'],
    ['declared response size', () => new Response('{}', { headers: { 'Content-Length': '65537' } }), 'PROVIDER_RESPONSE_TOO_LARGE'],
    ['actual response size', () => new Response('x'.repeat(65537)), 'PROVIDER_RESPONSE_TOO_LARGE'],
    ['truncation', () => new Response(JSON.stringify({ done: true, done_reason: 'length', message: { role: 'assistant', content: '{}' } })), 'MODEL_OUTPUT_TRUNCATED'],
  ] as const)('preserves the production %s boundary', async (_name, makeResponse, code) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(makeResponse());
    await expect(createOllamaProvider(config(), request).generate('Request', { signal: signal() })).rejects.toMatchObject({ code });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('keeps the single-active-request guard and permits subsequent generation after completion', async () => {
    let finish: (value: Response) => void = () => {};
    const request = vi.fn<typeof fetch>().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
      .mockImplementationOnce(async () => response());
    const provider = createOllamaProvider(config(), request);
    const first = provider.generate('First', { signal: signal() });
    await expect(provider.generate('Concurrent', { signal: signal() })).rejects.toMatchObject({ code: 'GENERATION_BUSY' });
    expect(request).toHaveBeenCalledTimes(1);
    finish(response());
    expect(await first).toEqual(compileSelectionPoc(selected));
    expect(await provider.generate('Next', { signal: signal() })).toEqual(compileSelectionPoc(selected));
    expect(request).toHaveBeenCalledTimes(2);
  });

  it.each([
    new Error('PRIVATE compiler fault'), new TypeError('PRIVATE compiler fault'),
    new TypeError('PRIVATE compiler fault', { cause: { code: 'ECONNREFUSED' } }),
  ])('preserves unexpected compiler fault identity and releases the request guard %#', async fault => {
    const original = selectionCompiler.compileSelectionPoc;
    const compiler = vi.spyOn(selectionCompiler, 'compileSelectionPoc').mockImplementationOnce(() => { throw fault; });
    try {
      const request = vi.fn<typeof fetch>().mockImplementation(async () => response());
      const diagnose = vi.fn();
      const provider = createOllamaProvider(config(), request, diagnose);
      await expect(provider.generate('Request', { signal: signal() })).rejects.toBe(fault);
      expect(request.mock.calls[0][1]?.signal?.aborted).toBe(true);
      expect(diagnose).not.toHaveBeenCalled();
      expect(await provider.generate('Next', { signal: signal() })).toEqual(original(selected));
      expect(request).toHaveBeenCalledTimes(2);
    } finally { compiler.mockRestore(); }
  });

  it.each([
    new Error('PRIVATE request fault'), new TypeError('PRIVATE request fault'),
    new TypeError('PRIVATE request fault', { cause: { code: 'ERR_INVALID_URL' } }),
  ])('does not assume an unidentified request exception is a network failure %#', async fault => {
    const request = vi.fn<typeof fetch>().mockRejectedValueOnce(fault).mockImplementation(async () => response());
    const provider = createOllamaProvider(config(), request);
    await expect(provider.generate('Request', { signal: signal() })).rejects.toBe(fault);
    expect(await provider.generate('Next', { signal: signal() })).toEqual(compileSelectionPoc(selected));
  });

  it.each([true, false])('classifies body-read failure by transport evidence, not TypeError alone: %s', async network => {
    const fault = new TypeError('PRIVATE body-read fault', network ? { cause: { code: 'UND_ERR_SOCKET' } } : undefined);
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.error(fault); } });
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(body)).mockImplementation(async () => response());
    const provider = createOllamaProvider(config(), request);
    const pending = provider.generate('Request', { signal: signal() });
    if (network) await expect(pending).rejects.toMatchObject({ code: 'OLLAMA_UNAVAILABLE' });
    else await expect(pending).rejects.toBe(fault);
    expect(await provider.generate('Next', { signal: signal() })).toEqual(compileSelectionPoc(selected));
  });
});
