import { z } from 'zod';

const localBaseUrl = z.string().transform((value, ctx) => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.port === '0') {
      throw new Error('Not a local Ollama origin');
    }
    // Pin localhost to a literal address instead of depending on DNS resolution.
    if (url.hostname === 'localhost') url.hostname = '127.0.0.1';
    return url.origin;
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Ollama must use an HTTP loopback origin without credentials, paths, or query parameters' });
    return z.NEVER;
  }
});

const ollamaEnvironmentSchema = z.object({
  OLLAMA_WORKFLOW: z.enum(['draft', 'semantic-plan', 'flat-selection']).default('draft'),
  OLLAMA_BASE_URL: localBaseUrl.default('http://127.0.0.1:11434'),
  OLLAMA_MODEL: z.string().min(1).max(120)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._/-]*(?::[a-zA-Z0-9][a-zA-Z0-9._-]*)?$/)
    .refine(value => !/(?:^|[-:/])cloud(?:$|[-:/])/i.test(value), 'Cloud model names are not allowed')
    .default('qwen3:4b-instruct'),
  OLLAMA_TIMEOUT_MS: z.coerce.number().int().min(100).max(180000).default(60000),
  OLLAMA_CONTEXT_SIZE: z.coerce.number().int().min(4096).max(16384).default(8192),
  OLLAMA_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(128).max(4096).default(2048),
  OLLAMA_RESPONSE_LIMIT_BYTES: z.coerce.number().int().min(4096).max(262144).default(65536),
}).refine(value => value.OLLAMA_MAX_OUTPUT_TOKENS <= value.OLLAMA_CONTEXT_SIZE / 2, {
  message: 'Reserve at least half the context for instructions and the UI request',
});

export function readProviderConfig(environment: NodeJS.ProcessEnv = process.env) {
  const provider = z.enum(['mock', 'ollama']).parse(environment.API_PROVIDER ?? 'mock');
  if (provider === 'mock') return { provider } as const;
  const env = ollamaEnvironmentSchema.parse(environment);
  return {
    provider,
    workflow: env.OLLAMA_WORKFLOW,
    baseUrl: env.OLLAMA_BASE_URL, model: env.OLLAMA_MODEL, timeoutMs: env.OLLAMA_TIMEOUT_MS,
    contextSize: env.OLLAMA_CONTEXT_SIZE, maxOutputTokens: env.OLLAMA_MAX_OUTPUT_TOKENS,
    responseLimitBytes: env.OLLAMA_RESPONSE_LIMIT_BYTES,
  } as const;
}

export type OllamaConfig = Extract<ReturnType<typeof readProviderConfig>, { provider: 'ollama' }>;
