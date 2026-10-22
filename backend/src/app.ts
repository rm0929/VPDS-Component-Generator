import { randomUUID } from 'node:crypto';
import express from 'express';
import type { ErrorRequestHandler, Request, Response } from 'express';
import cors from 'cors';
import { z } from 'zod';
import { uiSpecificationSchema } from '../../src/specification/uiSpecification';
import { readConfig } from './config';
import type { ApiConfig } from './config';
import { API_ERRORS, ApiError } from './errors';
import type { ApiErrorCode } from './errors';
import { generateWithTimeout } from './provider';
import type { GenerationProvider } from './provider';
import { createConfiguredProvider } from './providers';
import { createGenerationDiagnostics } from './diagnostics';
import type { GenerationDiagnostics } from './diagnostics';

const requestSchema = z.strictObject({ prompt: z.string().trim().min(1).max(2000) });

export type ApiLogEntry = {
  requestId: string; method: string; route: '/api/generate' | '/api/health' | 'unmatched';
  status: number; durationMs: number; errorCode?: ApiErrorCode;
};
export type ApiLogger = (entry: ApiLogEntry) => void;
export type AppOptions = { config?: ApiConfig; provider?: GenerationProvider; logger?: ApiLogger; diagnostics?: GenerationDiagnostics };

export function createApp(options: AppOptions = {}) {
  const config = options.config ?? readConfig();
  const diagnose = options.diagnostics ?? createGenerationDiagnostics();
  const provider = options.provider ?? createConfiguredProvider(undefined, diagnose);
  const logger = options.logger ?? (entry => console.log(JSON.stringify(entry)));
  const app = express();
  app.disable('x-powered-by');
  app.disable('etag');
  app.set('json escape', true);

  app.use((req, res, next) => {
    const requestId = randomUUID();
    const started = performance.now();
    res.locals.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('Cache-Control', 'no-store');
    let logged = false;
    const log = () => {
      if (logged) return;
      logged = true;
      const route = req.path === '/api/generate' || req.path === '/api/health' ? req.path : 'unmatched';
      const method = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'].includes(req.method) ? req.method : 'OTHER';
      try {
        logger({ requestId, method, route, status: res.writableFinished ? res.statusCode : 499,
          durationMs: Math.round(performance.now() - started),
          ...(res.locals.errorCode ? { errorCode: res.locals.errorCode as ApiErrorCode } : {}),
        });
      } catch { /* A failed logger must not break the API or expose request data. */ }
    };
    res.once('finish', log);
    res.once('close', log);
    next();
  });

  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) callback(null, true);
      else callback(new ApiError('CORS_ORIGIN_DENIED'));
    },
    methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type'],
    exposedHeaders: ['X-Request-ID'], credentials: false, maxAge: 600,
  }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', provider: provider.id, isMock: provider.isMock, requestId: res.locals.requestId });
  });

  app.post('/api/generate', (req, _res, next) => {
    next(req.is('application/json') ? undefined : new ApiError('UNSUPPORTED_MEDIA_TYPE'));
  }, express.json({ limit: config.bodyLimitBytes, inflate: false, strict: true }), async (req: Request, res: Response) => {
    const input = requestSchema.safeParse(req.body);
    if (!input.success) throw new ApiError('INVALID_REQUEST');
    const disconnected = new AbortController();
    const onClose = () => disconnected.abort();
    res.once('close', onClose);
    try {
      let output: unknown;
      try {
        output = await generateWithTimeout(provider, input.data.prompt, provider.timeoutMs ?? config.generationTimeoutMs, disconnected.signal);
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError('PROVIDER_FAILURE');
      }
      const parsed = uiSpecificationSchema.safeParse(output);
      if (!parsed.success) {
        diagnose('ui_schema', parsed.error.issues);
        throw new ApiError('INVALID_PROVIDER_OUTPUT');
      }
      if (!res.destroyed) res.json({
        data: { specification: parsed.data },
        meta: { provider: provider.id, isMock: provider.isMock }, requestId: res.locals.requestId,
      });
    } finally {
      res.removeListener('close', onClose);
    }
  });

  app.all('/api/generate', (_req, res, next) => {
    res.setHeader('Allow', 'POST, OPTIONS');
    next(new ApiError('METHOD_NOT_ALLOWED'));
  });
  app.all('/api/health', (_req, res, next) => {
    res.setHeader('Allow', 'GET, HEAD, OPTIONS');
    next(new ApiError('METHOD_NOT_ALLOWED'));
  });
  app.use((_req, _res, next) => next(new ApiError('NOT_FOUND')));

  const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    // Express identifies error middleware by its four-argument signature.
    void _next;
    if (res.headersSent || res.destroyed) return;
    let code: ApiErrorCode = 'INTERNAL_ERROR';
    if (error instanceof ApiError) code = error.code;
    else if (typeof error === 'object' && error !== null && 'type' in error) {
      if (error.type === 'entity.too.large') code = 'PAYLOAD_TOO_LARGE';
      else if (error.type === 'entity.parse.failed' || error.type === 'request.size.invalid' || error.type === 'request.aborted') code = 'INVALID_REQUEST';
      else if (error.type === 'encoding.unsupported' || error.type === 'charset.unsupported') code = 'UNSUPPORTED_MEDIA_TYPE';
    }
    res.locals.errorCode = code;
    res.status(API_ERRORS[code].status).json({ error: { code, message: API_ERRORS[code].message }, requestId: res.locals.requestId });
  };
  app.use(errorHandler);
  return app;
}
