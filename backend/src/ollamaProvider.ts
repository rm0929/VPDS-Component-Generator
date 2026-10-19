import { z } from 'zod';
import { ApiError } from './errors';
import type { GenerationProvider } from './provider';
import type { OllamaConfig } from './providerConfig';
import { buildModelInstructions, buildModelSchema, MODEL_EXAMPLE_REQUEST, MODEL_EXAMPLE_RESPONSE } from './modelSchema';
import { compileModelUi, ModelUiCompilationError } from './compileModelUi';
import { compileSemanticUiPlan, SemanticUiPlanCompilationError } from './compileSemanticUiPlan';
import { buildSemanticModelInstructions, buildSemanticModelSchema } from './semanticModelSchema';
import { createGenerationDiagnostics } from './diagnostics';
import type { GenerationDiagnostics } from './diagnostics';

const envelopeSchema = z.object({
  done: z.literal(true), done_reason: z.string().optional(),
  message: z.object({ role: z.literal('assistant'), content: z.string().min(1) }),
});

function parseJson(text: string, stage: 'ollama_response_json' | 'model_json', diagnose: GenerationDiagnostics): unknown {
  try { return JSON.parse(text); }
  catch { diagnose(stage); throw new ApiError('INVALID_MODEL_JSON'); }
}

async function readBoundedResponse(response: Response, byteLimit: number, diagnose: GenerationDiagnostics): Promise<unknown> {
  if (Number(response.headers.get('content-length')) > byteLimit) throw new ApiError('PROVIDER_RESPONSE_TOO_LARGE');
  if (!response.body) throw new ApiError('INVALID_MODEL_JSON');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > byteLimit) throw new ApiError('PROVIDER_RESPONSE_TOO_LARGE');
      chunks.push(value);
    }
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)); }
  catch { diagnose('ollama_response_json'); throw new ApiError('INVALID_MODEL_JSON'); }
  return parseJson(text, 'ollama_response_json', diagnose);
}

/** Native fetch keeps the local HTTP protocol visible and cancellable; no SDK. */
export function createOllamaProvider(config: OllamaConfig, request: typeof fetch = fetch,
  diagnose: GenerationDiagnostics = createGenerationDiagnostics()): GenerationProvider {
  const semantic = config.workflow === 'semantic-plan';
  const format = semantic ? buildSemanticModelSchema() : buildModelSchema();
  const instructions = semantic ? buildSemanticModelInstructions() : buildModelInstructions();
  // Keep the draft baseline's trusted demonstration and messages unchanged.
  const trustedMessages = semantic ? [{ role: 'system', content: instructions }]
    : [{ role: 'system', content: instructions },
      { role: 'user', content: MODEL_EXAMPLE_REQUEST },
      { role: 'assistant', content: MODEL_EXAMPLE_RESPONSE }];
  const compile = semantic ? compileSemanticUiPlan : compileModelUi;
  let active = false;
  return {
    id: semantic ? 'ollama-local-semantic-plan' : 'ollama-local', isMock: false, timeoutMs: config.timeoutMs,
    async generate(prompt, { signal }) {
      signal.throwIfAborted();
      if (active) throw new ApiError('GENERATION_BUSY');
      active = true;
      const controller = new AbortController();
      const onAbort = () => controller.abort(signal.reason);
      signal.addEventListener('abort', onAbort, { once: true });
      let timedOut = false;
      let response: Response | undefined;
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, config.timeoutMs);
      try {
        response = await request(`${config.baseUrl}/api/chat`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          redirect: 'error', signal: controller.signal,
          body: JSON.stringify({
            model: config.model, stream: false, think: false,
            format, keep_alive: '2m',
            messages: [...trustedMessages, { role: 'user', content: prompt }],
            options: { temperature: 0, seed: 0, num_ctx: config.contextSize, num_predict: config.maxOutputTokens },
          }),
        });
        if (!response.ok) {
          // Never parse, echo, or log Ollama error text (it can include the prompt).
          throw new ApiError(response.status === 404 ? 'OLLAMA_MODEL_NOT_FOUND' : 'OLLAMA_REQUEST_FAILED');
        }
        const parsed = envelopeSchema.safeParse(await readBoundedResponse(response, config.responseLimitBytes, diagnose));
        if (!parsed.success) {
          diagnose('ollama_envelope', parsed.error.issues);
          throw new ApiError('INVALID_PROVIDER_OUTPUT');
        }
        if (parsed.data.done_reason === 'length') throw new ApiError('MODEL_OUTPUT_TRUNCATED');
        // Selected contract -> deterministic composition/identity -> authoritative validation.
        // The API also retains its final shared-schema validation boundary.
        return compile(parseJson(parsed.data.message.content, 'model_json', diagnose));
      } catch (error) {
        if (timedOut) throw new ApiError('GENERATION_TIMEOUT');
        if (signal.aborted) throw signal.reason;
        if (error instanceof SemanticUiPlanCompilationError) {
          diagnose(error.stage, error.issues);
          throw new ApiError('INVALID_PROVIDER_OUTPUT');
        }
        if (error instanceof ModelUiCompilationError) {
          diagnose(error.stage, error.issues);
          throw new ApiError(error.stage === 'unsupported_request' ? 'UNSUPPORTED_UI_REQUEST' : 'INVALID_PROVIDER_OUTPUT');
        }
        if (error instanceof ApiError) throw error;
        throw new ApiError('OLLAMA_UNAVAILABLE');
      } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        controller.abort(); // Also cancels unread/error/oversized response bodies.
        if (response?.body && !response.body.locked) void response.body.cancel().catch(() => {});
        active = false;
      }
    },
  };
}
