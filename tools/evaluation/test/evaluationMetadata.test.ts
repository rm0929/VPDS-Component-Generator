import { describe, expect, it, vi } from 'vitest';
import { runtimeMetadata } from '../assessment/metadata';
import { readProviderConfig } from '../../../apps/api/src/providerConfig';

function config() {
  const result = readProviderConfig({ API_PROVIDER: 'ollama' });
  if (result.provider !== 'ollama') throw new Error('Expected Ollama');
  return result;
}
const json = (body: unknown) => new Response(JSON.stringify(body));
const digest = 'a'.repeat(64);

describe('safe reproducibility metadata using mocked HTTP', () => {
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
});
