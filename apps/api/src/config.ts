import { z } from 'zod';

const origin = z.string().refine(value => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
  } catch { return false; }
}, 'Use an exact HTTP(S) origin without paths, credentials, or a trailing slash');

const flag = z.enum(['true', 'false']).transform(value => value === 'true');
const environmentSchema = z.object({
  API_PUBLIC_MODE: flag.default(false),
  API_PUBLIC_GENERATION_ENABLED: flag.default(false),
  API_RATE_LIMIT_ENABLED: flag.default(false),
  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).max(86400000).default(61000),
  API_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(100).default(1),
  API_DAILY_LIMIT_MAX: z.coerce.number().int().min(1).max(1000).default(20),
  API_HOST: z.enum(['127.0.0.1', 'localhost', '::1', '0.0.0.0']).default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  API_CORS_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173')
    .transform(value => value.split(',').map(item => item.trim()))
    .pipe(z.array(origin).min(1).max(10)),
  API_BODY_LIMIT_BYTES: z.coerce.number().int().min(256).max(65536).default(8192),
  API_GENERATION_TIMEOUT_MS: z.coerce.number().int().min(1).max(30000).default(5000),
  API_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(100).max(120000).default(15000),
}).refine(value => value.API_REQUEST_TIMEOUT_MS > value.API_GENERATION_TIMEOUT_MS, {
  message: 'The HTTP request timeout must exceed the generation timeout',
});

export function readConfig(environment: NodeJS.ProcessEnv = process.env) {
  const publicMode = environment.API_PUBLIC_MODE === 'true';
  const env = environmentSchema.parse({ ...environment,
    API_PORT: environment.API_PORT ?? (publicMode ? environment.PORT : undefined),
    API_RATE_LIMIT_ENABLED: environment.API_RATE_LIMIT_ENABLED ?? String(publicMode),
    API_GENERATION_TIMEOUT_MS: environment.API_GENERATION_TIMEOUT_MS ?? (environment.API_PROVIDER === 'groq' ? '25000' : undefined),
    API_REQUEST_TIMEOUT_MS: environment.API_REQUEST_TIMEOUT_MS ?? (environment.API_PROVIDER === 'groq' ? '120000' : undefined),
  });
  if (env.API_HOST === '0.0.0.0' && !env.API_PUBLIC_MODE) throw new Error('Public binding requires explicit API_PUBLIC_MODE=true.');
  if (env.API_PUBLIC_MODE && (environment.API_PROVIDER !== 'groq' || !env.API_RATE_LIMIT_ENABLED
    || env.API_CORS_ORIGINS.some(value => !value.startsWith('https://')))) {
    throw new Error('Public mode requires Groq, enabled request limits, and exact HTTPS frontend origins.');
  }
  return {
    host: env.API_HOST === 'localhost' ? '127.0.0.1' : env.API_HOST, port: env.API_PORT, corsOrigins: env.API_CORS_ORIGINS,
    publicMode: env.API_PUBLIC_MODE, publicGenerationEnabled: env.API_PUBLIC_GENERATION_ENABLED,
    rateLimit: { enabled: env.API_RATE_LIMIT_ENABLED, windowMs: env.API_RATE_LIMIT_WINDOW_MS,
      max: env.API_RATE_LIMIT_MAX, dailyMax: env.API_DAILY_LIMIT_MAX },
    bodyLimitBytes: env.API_BODY_LIMIT_BYTES,
    generationTimeoutMs: env.API_GENERATION_TIMEOUT_MS, requestTimeoutMs: env.API_REQUEST_TIMEOUT_MS,
  };
}

export type ApiConfig = ReturnType<typeof readConfig>;
