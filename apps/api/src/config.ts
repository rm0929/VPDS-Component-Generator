import { z } from 'zod';

const origin = z.string().refine(value => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
  } catch { return false; }
}, 'Use an exact HTTP(S) origin without paths, credentials, or a trailing slash');

const environmentSchema = z.object({
  API_HOST: z.enum(['127.0.0.1', 'localhost', '::1']).default('127.0.0.1'),
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
  const env = environmentSchema.parse(environment);
  return {
    host: env.API_HOST === 'localhost' ? '127.0.0.1' : env.API_HOST, port: env.API_PORT, corsOrigins: env.API_CORS_ORIGINS,
    bodyLimitBytes: env.API_BODY_LIMIT_BYTES,
    generationTimeoutMs: env.API_GENERATION_TIMEOUT_MS, requestTimeoutMs: env.API_REQUEST_TIMEOUT_MS,
  };
}

export type ApiConfig = ReturnType<typeof readConfig>;
