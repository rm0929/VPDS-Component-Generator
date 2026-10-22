import { describe, expect, it, vi } from 'vitest';
import { generateSelectionPoc } from '../selection/ollama';
import { buildSelectionModelSchema, selectionMessages } from '../../../apps/api/src/ai/model';
import { describePocFailure } from '../selection/diagnostics';
import { compileSelectionPoc } from '../../../apps/api/src/ai/selection';
import { readProviderConfig } from '../../../apps/api/src/providerConfig';
import type { OllamaConfig } from '../../../apps/api/src/providerConfig';

const config = (extra: Partial<OllamaConfig> = {}): OllamaConfig => {
  const config = readProviderConfig({ API_PROVIDER: 'ollama' });
  if (config.provider !== 'ollama') throw new Error('Expected Ollama');
  return { ...config, ...extra };
};
const selected = { version: 'selection-poc-2', form: { enabled: false, label: null }, components: [{ type: 'emailInput', props: { label: 'Email', required: false } }], unsupported: [] };
const response = (value: unknown = selected) => new Response(JSON.stringify({ done: true, message: { role: 'assistant', content: JSON.stringify(value) } }));
const signal = () => new AbortController().signal;

describe('isolated selection PoC mocked Ollama HTTP', () => {
  it('makes one local inference call with the flat grammar and fixed examples, then uses the shared compiler', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response());
    const output = await generateSelectionPoc('Developer-owned request', config(), signal(), request);
    expect(output.specification).toEqual(compileSelectionPoc(selected));
    expect(request).toHaveBeenCalledTimes(1);
    const [url, init] = request.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:11434/api/chat');
    expect(init).toMatchObject({ method: 'POST', redirect: 'error', signal: expect.any(AbortSignal) });
    expect(JSON.parse(String(init?.body))).toEqual({ model: 'qwen3:4b-instruct', stream: false, think: false, keep_alive: '2m',
      format: buildSelectionModelSchema(), messages: [...selectionMessages(), { role: 'user', content: 'Developer-owned request' }],
      options: { temperature: 0, seed: 0, num_ctx: 8192, num_predict: 2048 },
    });
  });
  it.each([
    [{ version: 'selection-poc-2', form: { enabled: false, label: null }, components: [], unsupported: ['behavior'] }, 'unsupported'],
    [{ ...selected, components: [{ type: 'select', props: { label: 'PRIVATE' } }] }, 'selection_schema'],
    [{ ...selected, components: [{ type: 'emailInput', props: { label: 'PRIVATE', disabled: null } }] }, 'selection_schema'],
    [{ ...selected, components: [{ type: 'button', props: { label: 'PRIVATE', type: 'submit' } }] }, 'composition'],
  ])('preserves actual selection failure stages without another model call %#', async (value, stage) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response(value));
    try { await generateSelectionPoc('PRIVATE request', config(), signal(), request); throw new Error('Expected failure'); }
    catch (error) {
      const diagnostic = describePocFailure(error);
      expect(diagnostic.stage).toBe(stage);
      expect(JSON.stringify(diagnostic)).not.toContain('PRIVATE');
      if (stage === 'selection_schema' && 'disabled' in value.components[0].props) expect(diagnostic.issues[0].path).toEqual(['components', 0, 'props', 'disabled']);
    }
    expect(request).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['http-json', () => new Response('{'), 'ollama_response_json'],
    ['utf8', () => new Response(new Uint8Array([0xff])), 'ollama_response_json'],
    ['envelope', () => new Response(JSON.stringify({ done: false })), 'ollama_envelope'],
    ['model-json', () => new Response(JSON.stringify({ done: true, message: { role: 'assistant', content: 'PRIVATE invalid JSON' } })), 'model_json'],
  ] as const)('reports safe %s processing failures', async (_name, makeResponse, stage) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(makeResponse());
    try { await generateSelectionPoc('PRIVATE prompt', config(), signal(), request); throw new Error('Expected failure'); }
    catch (error) { expect(describePocFailure(error).stage).toBe(stage); expect(JSON.stringify(describePocFailure(error))).not.toContain('PRIVATE'); }
  });
  it.each([404, 500, 307])('keeps HTTP %s error bodies private', async status => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response('PRIVATE server body', { status }));
    await expect(generateSelectionPoc('PRIVATE', config(), signal(), request)).rejects.toMatchObject({ code: status === 404 ? 'OLLAMA_MODEL_NOT_FOUND' : 'OLLAMA_REQUEST_FAILED' });
  });
  it('rejects connection failures, token truncation and oversized actual/declared response bodies', async () => {
    for (const [request, code] of [
      [vi.fn<typeof fetch>().mockRejectedValue(new TypeError('PRIVATE server address')), 'OLLAMA_UNAVAILABLE'],
      [vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ done: true, done_reason: 'length', message: { role: 'assistant', content: '{}' } }))), 'MODEL_OUTPUT_TRUNCATED'],
      [vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { headers: { 'Content-Length': '70000' } })), 'PROVIDER_RESPONSE_TOO_LARGE'],
      [vi.fn<typeof fetch>().mockResolvedValue(new Response('x'.repeat(65537))), 'PROVIDER_RESPONSE_TOO_LARGE'],
    ] as const) await expect(generateSelectionPoc('Prompt', config(), signal(), request)).rejects.toMatchObject({ code });
  });
  it('does not call HTTP when already aborted', async () => {
    const controller = new AbortController(); controller.abort();
    const request = vi.fn<typeof fetch>();
    await expect(generateSelectionPoc('Prompt', config(), controller.signal, request)).rejects.toMatchObject({ name: 'AbortError' });
    expect(request).not.toHaveBeenCalled();
  });
  it.each(['cancel', 'timeout'] as const)('honors actual HTTP signal %s without a retry', async mode => {
    const controller = new AbortController();
    let downstream: AbortSignal | undefined;
    const request = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      downstream = init?.signal ?? undefined;
      downstream?.addEventListener('abort', () => reject(downstream?.reason), { once: true });
    }));
    const attempt = generateSelectionPoc('Prompt', config({ timeoutMs: 20 }), controller.signal, request);
    const result = expect(attempt).rejects.toMatchObject(mode === 'cancel' ? { name: 'AbortError' } : { code: 'GENERATION_TIMEOUT' });
    if (mode === 'cancel') controller.abort();
    await result;
    expect(downstream?.aborted).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
