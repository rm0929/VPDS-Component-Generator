import { describe, expect, it, vi } from 'vitest';
import { runtimeMetadata } from '../evaluation/metadata';
import { evaluationProvider } from '../evaluation/evaluationProvider';
import { readProviderConfig } from '../src/providerConfig';
import draft from '../src/fixtures/registration-draft.json';
import { experimentMessages } from '../evaluation/promptExperiments';

function config() {
  const result = readProviderConfig({ API_PROVIDER: 'ollama' });
  if (result.provider !== 'ollama') throw new Error('Expected Ollama');
  return result;
}
const json = (body: unknown) => new Response(JSON.stringify(body));
const digest = 'a'.repeat(64);

describe('safe reproducibility metadata using mocked HTTP', () => {
  it('uses only the replacement system message plus the actual request with unchanged format/settings', async () => {
    const request = vi.fn<typeof fetch>().mockImplementation(async () => json({ done: true, message: { role: 'assistant', content: JSON.stringify(draft) } }));
    for (const variant of ['baseline', 'concise-v1'] as const) {
      const provider = evaluationProvider(config(), experimentMessages(variant), () => {}, request);
      await provider.generate('Developer-owned synthetic request', { signal: new AbortController().signal });
    }
    const bodies = request.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
    const { messages: previous, ...previousOptions } = bodies[0];
    const { messages: replacement, ...replacementOptions } = bodies[1];
    expect(previous).toHaveLength(4);
    expect(replacement).toEqual([...experimentMessages('concise-v1'), { role: 'user', content: 'Developer-owned synthetic request' }]);
    expect(replacementOptions).toEqual(previousOptions);
  });
  it('retains authoritative form-ancestry rejection with the replacement prompt', async () => {
    const malformed = { irVersion: '1', status: 'supported', root: { type: 'button', props: { label: 'Synthetic action', type: 'submit' } } };
    const request = vi.fn<typeof fetch>().mockResolvedValue(json({ done: true, message: { role: 'assistant', content: JSON.stringify(malformed) } }));
    const diagnose = vi.fn();
    const provider = evaluationProvider(config(), experimentMessages('concise-v1'), diagnose, request);
    await expect(provider.generate('Developer-owned request', { signal: new AbortController().signal })).rejects.toMatchObject({ code: 'INVALID_PROVIDER_OUTPUT' });
    expect(diagnose).toHaveBeenCalledWith('ui_schema', expect.arrayContaining([expect.objectContaining({ path: ['root'], code: 'custom' })]));
  });
  it('records only the selected model digest and runtime version', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ version: '0.40.5' }))
      .mockResolvedValueOnce(json({ models: [{ name: 'other-private-model', digest: 'b'.repeat(64) }, { name: 'qwen3:4b-instruct', digest }] }));
    expect(await runtimeMetadata(config(), request)).toEqual({ ollamaVersion: '0.40.5', modelDigest: digest });
    expect(request.mock.calls.map(([url]) => url)).toEqual(['http://127.0.0.1:11434/api/version', 'http://127.0.0.1:11434/api/tags']);
    expect(request.mock.calls[0][1]).toMatchObject({ redirect: 'error', signal: expect.any(AbortSignal) });
  });
  it.each([{ version: 'private\nerror' }, { version: 'x'.repeat(100) }, {}, { version: 10 }])('rejects unsafe/malformed metadata %#', async body => {
    await expect(runtimeMetadata(config(), vi.fn<typeof fetch>().mockResolvedValue(json(body)))).rejects.toThrow();
  });
  it('fails before inference if the exact configured model is absent', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ version: '0.40.5' })).mockResolvedValueOnce(json({ models: [] }));
    await expect(runtimeMetadata(config(), request)).rejects.toThrow('Configured local model not installed');
  });
  it('bounds chunked metadata and cancels oversized bodies', async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(65537)); }, cancel });
    await expect(runtimeMetadata(config(), vi.fn<typeof fetch>().mockResolvedValue(new Response(body)))).rejects.toThrow('Metadata limit exceeded');
    expect(cancel).toHaveBeenCalled();
  });
  it('changes only trusted messages while preserving actual prompt, format, HTTP signal, and compiler', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(json({ done: true, message: { role: 'assistant', content: JSON.stringify(draft) } }));
    const messages = [{ role: 'system' as const, content: 'Fixed experiment' }];
    const provider = evaluationProvider(config(), messages, () => {}, request);
    const output = await provider.generate('Actual user input', { signal: new AbortController().signal });
    const init = request.mock.calls[0][1];
    const payload = JSON.parse(String(init?.body));
    expect(payload.messages).toEqual([...messages, { role: 'user', content: 'Actual user input' }]);
    expect(payload.format).toHaveProperty('definitions');
    expect(payload.options).toMatchObject({ temperature: 0, seed: 0 });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(output).toMatchObject({ version: '1.0', root: { id: 'node-0' } });
  });
});
