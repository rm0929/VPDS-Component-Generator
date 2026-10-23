import { z } from 'zod';
import { ApiError } from '../../../apps/api/src/errors';
import type { OllamaConfig } from '../../../apps/api/src/providerConfig';
import { compileSelectionPoc, selectionSchema, SelectionPocError } from '../../../apps/api/src/ai/selection';
import { buildSelectionModelSchema, selectionMessages } from '../../../apps/api/src/ai/model';

export class PocTransportError extends Error {
  constructor(readonly stage: 'ollama_response_json' | 'model_json' | 'ollama_envelope', readonly issues: readonly z.core.$ZodIssue[] = []) {
    super('The isolated PoC response could not be read.');
  }
}
function parseJson(text: string, stage: 'ollama_response_json' | 'model_json'): unknown {
  try { return JSON.parse(text); } catch { throw new PocTransportError(stage); }
}

/** Manual-only HTTP path. No provider registration or production workflow changes. */
export async function requestSelectionPoc(prompt: string, config: OllamaConfig, signal: AbortSignal, request: typeof fetch = fetch) {
  signal.throwIfAborted();
  const deadline = AbortSignal.timeout(config.timeoutMs);
  const combined = AbortSignal.any([signal, deadline]);
  let response: Response | undefined;
  try {
    response = await request(`${config.baseUrl}/api/chat`, {
      method: 'POST', redirect: 'error', signal: combined, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model, stream: false, think: false, format: buildSelectionModelSchema(), keep_alive: '2m',
        messages: [...selectionMessages(), { role: 'user', content: prompt }],
        options: { temperature: 0, seed: 0, num_ctx: config.contextSize, num_predict: config.maxOutputTokens } }),
    });
    if (!response.ok) throw new ApiError(response.status === 404 ? 'OLLAMA_MODEL_NOT_FOUND' : 'OLLAMA_REQUEST_FAILED');
    if (Number(response.headers.get('content-length')) > config.responseLimitBytes) throw new ApiError('PROVIDER_RESPONSE_TOO_LARGE');
    if (!response.body) throw new PocTransportError('ollama_response_json');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > config.responseLimitBytes) throw new ApiError('PROVIDER_RESPONSE_TOO_LARGE');
        chunks.push(value);
      }
    } catch (error) { void reader.cancel().catch(() => {}); throw error; }
    finally { reader.releaseLock(); }
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)); }
    catch { throw new PocTransportError('ollama_response_json'); }
    const envelope = z.object({ done: z.literal(true), done_reason: z.string().optional(),
      message: z.object({ role: z.literal('assistant'), content: z.string().min(1) }),
    }).safeParse(parseJson(text, 'ollama_response_json'));
    if (!envelope.success) throw new PocTransportError('ollama_envelope', envelope.error.issues);
    if (envelope.data.done_reason === 'length') throw new ApiError('MODEL_OUTPUT_TRUNCATED');
    const selection = selectionSchema.safeParse(parseJson(envelope.data.message.content, 'model_json'));
    if (!selection.success) throw new SelectionPocError('selection_schema', selection.error.issues);
    return selection.data;
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    if (deadline.aborted) throw new ApiError('GENERATION_TIMEOUT');
    // Preserve compiler and transport stages. Network errors have no developer-owned stage.
    if (error instanceof TypeError) throw new ApiError('OLLAMA_UNAVAILABLE');
    throw error;
  } finally {
    if (response?.body && !response.body.locked) void response.body.cancel().catch(() => {});
  }
}

export async function generateSelectionPoc(prompt: string, config: OllamaConfig, signal: AbortSignal, request: typeof fetch = fetch) {
  const selection = await requestSelectionPoc(prompt, config, signal, request);
  return { selection, specification: compileSelectionPoc(selection) };
}
