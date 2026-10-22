import { describe, expect, it, vi } from 'vitest';
import { generateSpecification, GenerationClientError } from './generateSpecification';
import { API_ERRORS } from '@vpds/ui-specification/contracts/apiErrors';

const specification = { version: '1.0', root: { id: 'root', type: 'text', props: { content: 'Example' } } };
const success = { data: { specification }, meta: { provider: 'ollama-local-flat-selection', isMock: false }, requestId: '00000000-0000-4000-8000-000000000001' };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

describe('typed specification API client', () => {
  it('posts the trimmed prompt with cancellation and returns validated data', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response(success));
    const signal = new AbortController().signal;
    expect(await generateSpecification('  Example request  ', { request, signal })).toEqual(success);
    expect(request).toHaveBeenCalledExactlyOnceWith('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Example request' }), signal, credentials: 'omit', cache: 'no-store', redirect: 'error' });
  });

  it.each(Object.entries(API_ERRORS))('handles %s with a developer-owned message, not server text', async (code, detail) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response({ error: { code, message: 'PRIVATE SERVER TEXT' }, requestId: success.requestId }, detail.status));
    try { await generateSpecification('Example', { request }); throw new Error('Expected failure'); }
    catch (error) {
      expect(error).toBeInstanceOf(GenerationClientError);
      expect(error).toMatchObject({ code });
      expect(String(error)).not.toContain('PRIVATE');
    }
  });

  it.each([
    {}, { ...success, requestId: 'invalid' }, { ...success, meta: { isMock: false } },
    { ...success, data: { specification: { version: '2.0', root: specification.root } } },
    { ...success, data: { specification: { version: '1.0', root: { ...specification.root, props: { content: 'Example', onClick: 'PRIVATE' } } } } },
    { ...success, data: { specification: { version: '1.0', root: { ...specification.root, type: 'select' } } } },
  ])('rejects malformed/unsafe success data %#', async body => {
    await expect(generateSpecification('Example', { request: vi.fn<typeof fetch>().mockResolvedValue(response(body)) }))
      .rejects.toMatchObject({ code: 'MALFORMED_RESPONSE' });
  });

  it.each([
    () => new Response('<html>PRIVATE</html>', { status: 200 }),
    () => new Response('PRIVATE invalid JSON', { headers: { 'Content-Type': 'application/json' } }),
    () => response({ error: { code: 'INTERNAL_ERROR' } }, 500),
  ])('handles unreadable success/error responses safely %#', async makeResponse => {
    await expect(generateSpecification('Example', { request: vi.fn<typeof fetch>().mockResolvedValue(makeResponse()) }))
      .rejects.toMatchObject({ code: 'MALFORMED_RESPONSE' });
  });

  it.each([500, 502, 503, 504])('reports proxy connection failures at HTTP %s without displaying server content', async status => {
    await expect(generateSpecification('Example', {
      request: vi.fn<typeof fetch>().mockResolvedValue(new Response('PRIVATE proxy failure', { status })),
    })).rejects.toMatchObject({ code: 'NETWORK_ERROR', message: expect.stringContaining('Cannot reach the generation backend') });
  });

  it('handles unknown error codes and network failures without echoing exception details', async () => {
    await expect(generateSpecification('Example', { request: vi.fn<typeof fetch>().mockResolvedValue(response({
      error: { code: 'PRIVATE', message: 'PRIVATE' }, requestId: success.requestId }, 500)) })).rejects.toMatchObject({ code: 'UNKNOWN_API_ERROR' });
    await expect(generateSpecification('Example', { request: vi.fn<typeof fetch>().mockRejectedValue(new TypeError('PRIVATE')) }))
      .rejects.toMatchObject({ code: 'NETWORK_ERROR', message: expect.not.stringContaining('PRIVATE') });
  });

  it.each(['', '   ', 'x'.repeat(2001)])('rejects invalid prompts before HTTP %#', async prompt => {
    const request = vi.fn<typeof fetch>();
    await expect(generateSpecification(prompt, { request })).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(request).not.toHaveBeenCalled();
  });

  it('does not request when aborted and never accepts a late response ignoring abort', async () => {
    const controller = new AbortController(); controller.abort();
    const request = vi.fn<typeof fetch>();
    await expect(generateSpecification('Example', { request, signal: controller.signal })).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(request).not.toHaveBeenCalled();
    const later = new AbortController();
    const pendingRequest = vi.fn<typeof fetch>().mockImplementation(async () => { later.abort(); return response(success); });
    await expect(generateSpecification('Example', { request: pendingRequest, signal: later.signal })).rejects.toMatchObject({ code: 'CANCELLED' });
  });

  it('recognizes cancellation while the response body is being read', async () => {
    const controller = new AbortController();
    const body = response(success);
    vi.spyOn(body, 'json').mockImplementation(async () => { controller.abort(); throw new Error('PRIVATE abort reason'); });
    await expect(generateSpecification('Example', { request: vi.fn<typeof fetch>().mockResolvedValue(body), signal: controller.signal }))
      .rejects.toMatchObject({ code: 'CANCELLED' });
  });
});
