import { describe, expect, it } from 'vitest';
import { readConfig } from '../src/config';
import { createApiServer } from '../src/httpServer';

describe('backend configuration', () => {
  it('has bounded local-development defaults and explicit HTTP transport timeouts', () => {
    const config = readConfig({});
    expect(config).toEqual({
      host: '127.0.0.1', port: 3001, corsOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173'],
      publicMode: false, publicGenerationEnabled: false,
      rateLimit: { enabled: false, windowMs: 61000, max: 1, dailyMax: 20 },
      bodyLimitBytes: 8192, generationTimeoutMs: 5000, requestTimeoutMs: 15000,
    });
    const server = createApiServer({ config, logger: () => {} });
    expect(server.requestTimeout).toBe(15000);
    expect(server.headersTimeout).toBe(10000);
    expect(server.keepAliveTimeout).toBe(5000);
  });

  it('parses configured values without consuming unrelated environment variables', () => {
    expect(readConfig({ API_PORT: '4001', API_CORS_ORIGINS: 'https://example.com, http://localhost:5174', UNRELATED: 'not-used' }))
      .toMatchObject({ port: 4001, corsOrigins: ['https://example.com', 'http://localhost:5174'] });
  });

  it.each([
    { API_PORT: '0' }, { API_PORT: '65536' }, { API_PORT: 'invalid' }, { API_HOST: 'remote.example' },
    { API_CORS_ORIGINS: '*' }, { API_CORS_ORIGINS: '' }, { API_CORS_ORIGINS: 'https://example.com/path' },
    { API_CORS_ORIGINS: 'https://user:password@example.com' }, { API_CORS_ORIGINS: 'https://example.com/' },
    { API_BODY_LIMIT_BYTES: '0' }, { API_BODY_LIMIT_BYTES: '100000000' },
    { API_GENERATION_TIMEOUT_MS: '0' }, { API_GENERATION_TIMEOUT_MS: '30001' },
    { API_REQUEST_TIMEOUT_MS: '1000', API_GENERATION_TIMEOUT_MS: '2000' },
  ])('rejects invalid environment settings %#', environment => {
    expect(() => readConfig(environment)).toThrow();
  });
});
