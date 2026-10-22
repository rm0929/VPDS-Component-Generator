import { z } from 'zod';
import { ApiError } from '../errors';
import type { GenerationProvider } from '../provider';
import type { GroqConfig } from '../providerConfig';
import { createGenerationDiagnostics } from '../diagnostics';
import type { GenerationDiagnostics } from '../diagnostics';
import { buildGroqSelectionSchema, decodeGroqSelection, groqSelectionMessages } from './groqSelectionSchema';
import { compileSelectionPoc, SelectionPocError } from './selection';
import { ModelUiCompilationError } from './compileModelUi';

const envelope = z.object({ choices: z.array(z.object({ finish_reason: z.string(),
  message: z.object({ content: z.string().nullable(), refusal: z.string().nullable().optional() }) })).length(1) });
const transportCodes = new Set(['ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT',
  'EHOSTUNREACH', 'ENETUNREACH', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'UND_ERR_SOCKET']);
function transportFailure(error: unknown): boolean {
  const code = (value: unknown) => typeof value === 'object' && value !== null && 'code' in value
    && typeof value.code === 'string' && transportCodes.has(value.code);
  return code(error) || (error instanceof Error && code(error.cause));
}
function retryAfter(value: string | null) {
  return value !== null && /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 86400 ? Number(value) : 60;
}
async function readResponse(response: Response, limit: number) {
  if (Number(response.headers.get('content-length')) > limit) throw new ApiError('PROVIDER_RESPONSE_TOO_LARGE');
  if (!response.body) throw new ApiError('INVALID_PROVIDER_OUTPUT');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read().catch((error: unknown) => {
        if (transportFailure(error)) throw new ApiError('PROVIDER_UNAVAILABLE');
        throw error;
      });
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new ApiError('PROVIDER_RESPONSE_TOO_LARGE');
      chunks.push(value);
    }
  } catch (error) { void reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))) as unknown; }
  catch { throw new ApiError('INVALID_PROVIDER_OUTPUT'); }
}

/** No independent inference timer: the API's one deadline owns this HTTP signal. */
export function createGroqProvider(config: GroqConfig, request: typeof fetch = fetch,
  diagnose: GenerationDiagnostics = createGenerationDiagnostics()): GenerationProvider {
  const schema = buildGroqSelectionSchema(); const messages = groqSelectionMessages(); let active = false;
  return { id: 'groq-flat-selection', isMock: false,
    async generate(prompt, { signal }) {
      signal.throwIfAborted();
      if (active) throw new ApiError('GENERATION_BUSY');
      active = true; let response: Response | undefined;
      try {
        try {
          response = await request('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST', redirect: 'error', signal,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
            body: JSON.stringify({ model: config.model, messages: [...messages, { role: 'user', content: prompt }],
              response_format: { type: 'json_schema', json_schema: { name: 'ui_selection', strict: true, schema } },
              temperature: 0, reasoning_effort: 'low', max_completion_tokens: config.maxOutputTokens, stream: false }),
          });
        } catch (error) {
          if (transportFailure(error)) throw new ApiError('PROVIDER_UNAVAILABLE');
          throw error;
        }
        if (response.status === 429) throw new ApiError('RATE_LIMITED', retryAfter(response.headers.get('retry-after')));
        if ([400, 401, 403, 404, 422].includes(response.status)) throw new ApiError('PROVIDER_CONFIGURATION_ERROR');
        if (!response.ok) throw new ApiError('PROVIDER_UNAVAILABLE');
        const parsed = envelope.safeParse(await readResponse(response, config.responseLimitBytes));
        signal.throwIfAborted();
        if (!parsed.success) throw new ApiError('INVALID_PROVIDER_OUTPUT');
        const choice = parsed.data.choices[0];
        if (choice.finish_reason === 'length') throw new ApiError('MODEL_OUTPUT_TRUNCATED');
        if (choice.finish_reason !== 'stop' || choice.message.refusal || !choice.message.content) throw new ApiError('INVALID_PROVIDER_OUTPUT');
        let model: unknown;
        try { model = JSON.parse(choice.message.content); }
        catch { diagnose('model_json'); throw new ApiError('INVALID_PROVIDER_OUTPUT'); }
        return compileSelectionPoc(decodeGroqSelection(model));
      } catch (error) {
        if (signal.aborted) throw signal.reason;
        if (error instanceof z.ZodError) { diagnose('selection_schema', error.issues); throw new ApiError('INVALID_PROVIDER_OUTPUT'); }
        if (error instanceof SelectionPocError) {
          diagnose(error.stage === 'unsupported' ? 'unsupported_request' : error.stage, error.issues);
          throw new ApiError(error.stage === 'unsupported' ? 'UNSUPPORTED_UI_REQUEST' : 'INVALID_PROVIDER_OUTPUT');
        }
        if (error instanceof ModelUiCompilationError) { diagnose(error.stage, error.issues); throw new ApiError('INVALID_PROVIDER_OUTPUT'); }
        throw error; // Programming errors retain the existing API internal/provider-error handling.
      } finally {
        if (response?.body && !response.body.locked) void response.body.cancel().catch(() => {});
        active = false;
      }
    },
  };
}
