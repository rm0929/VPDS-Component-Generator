import { z } from 'zod';
import type { ApiErrorCode } from '@vpds/ui-specification/contracts/apiErrors';
import { uiSpecificationSchema } from '@vpds/ui-specification/uiSpecification';

const apiMessages = {
  PUBLIC_GENERATION_DISABLED: 'Public generation is not enabled yet. The deployment is still being verified.',
  RATE_LIMITED: 'The generation quota is temporarily exhausted. Wait before trying again.',
  PROVIDER_UNAVAILABLE: 'The inference service is unavailable. Try again later.',
  PROVIDER_CONFIGURATION_ERROR: 'The inference service needs configuration. Contact the application owner.',
  INVALID_REQUEST: 'Enter a description between 1 and 2000 characters.',
  PAYLOAD_TOO_LARGE: 'The description is too large. Shorten it and try again.',
  UNSUPPORTED_MEDIA_TYPE: 'The backend could not read this request. Check the application setup.',
  UNSUPPORTED_PROMPT: 'The backend is using mock examples. Configure the flat-selection workflow for Experimental AI.',
  UNSUPPORTED_UI_REQUEST: 'This request includes a component, property, behavior, or grouping outside the supported scope. Simplify it and try again.',
  PROVIDER_FAILURE: 'Generation failed inside the backend. Try again or check the backend.',
  INVALID_PROVIDER_OUTPUT: 'The model returned an invalid interface. No preview was displayed. Try again with a clearer description.',
  INCOMPLETE_REQUIREMENTS: 'Generation missed requested details. Review your description and try again.',
  GENERATION_TIMEOUT: 'Generation timed out. Try a shorter description or try again later.',
  GENERATION_BUSY: 'Generation is still busy. Wait briefly before trying again.',
  OLLAMA_UNAVAILABLE: 'Cannot reach local Ollama. Check that it is running on loopback.',
  OLLAMA_MODEL_NOT_FOUND: 'The configured model is not available in Ollama. Check the local model setup.',
  OLLAMA_REQUEST_FAILED: 'Ollama rejected generation. Check the backend and model configuration.',
  INVALID_MODEL_JSON: 'The model did not return readable structured output. Try again.',
  MODEL_OUTPUT_TRUNCATED: 'The model output was cut short. Request a smaller interface.',
  PROVIDER_RESPONSE_TOO_LARGE: 'The generated response was too large. Request a smaller interface.',
  CORS_ORIGIN_DENIED: 'This frontend origin is not allowed. Check the backend CORS configuration.',
  METHOD_NOT_ALLOWED: 'The generation endpoint is configured incorrectly. Check the application setup.',
  NOT_FOUND: 'The generation endpoint was not found. Check the configured API address.',
  INTERNAL_ERROR: 'The backend encountered an unexpected error. Check the backend before trying again.',
} satisfies Record<ApiErrorCode, string>;

const clientMessages = {
  NETWORK_ERROR: 'Cannot reach the generation backend. Check the connection and configured API address; a free hosted server may be waking up.',
  MALFORMED_RESPONSE: 'The backend returned an unexpected response. Check the backend and proxy; no preview was displayed.',
  UNKNOWN_API_ERROR: 'Generation failed with an unrecognized backend response. Check the backend.',
  WRONG_PROVIDER: 'AI generation requires a real flat-selection backend (local Ollama or hosted Groq). Check the backend configuration.',
  BACKEND_TIMEOUT: 'The backend did not respond in time. A free hosted server may still be waking up; try again later.',
  API_CONFIGURATION_ERROR: 'The frontend API address is invalid. Configure an exact HTTPS backend origin.',
  CANCELLED: 'Generation cancelled.',
  CLIENT_FAILURE: 'The generated interface could not be displayed. Try again or check the application setup.',
};
export type GenerationErrorCode = ApiErrorCode | keyof typeof clientMessages;
export class GenerationClientError extends Error {
  readonly code: GenerationErrorCode;
  constructor(code: GenerationErrorCode) {
    super({ ...apiMessages, ...clientMessages }[code]);
    this.code = code;
  }
}

const responseSchema = z.strictObject({
  data: z.strictObject({ specification: uiSpecificationSchema }),
  meta: z.strictObject({ provider: z.string().min(1).max(120), isMock: z.boolean() }),
  requestId: z.uuid(),
});
const errorSchema = z.strictObject({
  error: z.strictObject({ code: z.string().min(1).max(100), message: z.string().max(1000) }),
  requestId: z.uuid(),
});
export type GenerateResponse = z.infer<typeof responseSchema>;

function checkCancellation(signal?: AbortSignal) {
  if (signal?.aborted) throw new GenerationClientError('CANCELLED');
}

/** Only developer-owned messages reach the UI; never display server error text. */
export function generationEndpoint(baseUrl: string) {
  if (!baseUrl) return '/api/generate';
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:' || url.origin !== baseUrl) throw new Error('Invalid API origin');
    return `${url.origin}/api/generate`;
  } catch { throw new GenerationClientError('API_CONFIGURATION_ERROR'); }
}

export async function generateSpecification(prompt: string,
  { signal, request = fetch, baseUrl = import.meta.env.VITE_API_BASE_URL ?? '' }:
  { signal?: AbortSignal; request?: typeof fetch; baseUrl?: string } = {}): Promise<GenerateResponse> {
  const endpoint = generationEndpoint(baseUrl);
  if (!baseUrl) return requestSpecification(prompt, signal, request, endpoint);
  // Transport/cold-start ceiling, distinct from the server's one inference deadline.
  const controller = new AbortController(); let timedOut = false;
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 90000);
  try { return await requestSpecification(prompt, controller.signal, request, endpoint); }
  catch (error) {
    checkCancellation(signal);
    if (timedOut) throw new GenerationClientError('BACKEND_TIMEOUT');
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}

async function requestSpecification(prompt: string, signal: AbortSignal | undefined, request: typeof fetch,
  endpoint: string): Promise<GenerateResponse> {
  checkCancellation(signal);
  const trimmed = prompt.trim();
  if (!trimmed || trimmed.length > 2000) throw new GenerationClientError('INVALID_REQUEST');
  let response: Response;
  try {
    response = await request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: trimmed }), signal, credentials: 'omit', cache: 'no-store', redirect: 'error' });
  } catch {
    checkCancellation(signal);
    throw new GenerationClientError('NETWORK_ERROR');
  }
  let body: unknown;
  // Vite returns an empty/plain-text 5xx when its backend connection fails.
  // Valid API JSON errors still go through the existing typed error contract.
  if ([500, 502, 503, 504].includes(response.status)
    && response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    checkCancellation(signal);
    throw new GenerationClientError('NETWORK_ERROR');
  }
  try {
    if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new Error('Unexpected content type');
    body = await response.json();
  } catch {
    checkCancellation(signal);
    throw new GenerationClientError('MALFORMED_RESPONSE');
  }
  checkCancellation(signal);
  if (!response.ok) {
    const error = errorSchema.safeParse(body);
    if (!error.success) throw new GenerationClientError('MALFORMED_RESPONSE');
    const code = error.data.error.code;
    throw new GenerationClientError(Object.hasOwn(apiMessages, code) ? code as ApiErrorCode : 'UNKNOWN_API_ERROR');
  }
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw new GenerationClientError('MALFORMED_RESPONSE');
  return parsed.data;
}
