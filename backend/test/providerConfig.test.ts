import { describe, expect, it } from 'vitest';
import { readConfig } from '../src/config';
import { readProviderConfig } from '../src/providerConfig';
import { createConfiguredProvider } from '../src/providers';
import { mockProvider } from '../src/mockProvider';

describe('explicit local provider configuration', () => {
  it('defaults to the existing mock without requiring Ollama configuration or a running server', () => {
    expect(readProviderConfig({})).toEqual({ provider: 'mock' });
    expect(createConfiguredProvider(readProviderConfig({}))).toBe(mockProvider);
    expect(readProviderConfig({ API_PROVIDER: 'mock', OLLAMA_BASE_URL: 'unused' })).toEqual({ provider: 'mock' });
  });

  it('configures bounded Ollama defaults suitable as a starting point for 16 GB memory', () => {
    const config = readProviderConfig({ API_PROVIDER: 'ollama' });
    expect(config).toEqual({
      provider: 'ollama', workflow: 'draft', baseUrl: 'http://127.0.0.1:11434', model: 'qwen3:4b-instruct', timeoutMs: 60000,
      contextSize: 8192, maxOutputTokens: 2048, responseLimitBytes: 65536,
    });
    expect(createConfiguredProvider(config)).toMatchObject({ id: 'ollama-local', isMock: false, timeoutMs: 60000 });
  });

  it('selects semantic plans only through an explicit Ollama workflow setting', () => {
    const config = readProviderConfig({ API_PROVIDER: 'ollama', OLLAMA_WORKFLOW: 'semantic-plan' });
    expect(config).toMatchObject({ workflow: 'semantic-plan', model: 'qwen3:4b-instruct' });
    expect(createConfiguredProvider(config)).toMatchObject({ id: 'ollama-local-semantic-plan', isMock: false });
    expect(readProviderConfig({ API_PROVIDER: 'mock', OLLAMA_WORKFLOW: 'semantic-plan' })).toEqual({ provider: 'mock' });
    expect(readProviderConfig({ API_PROVIDER: 'ollama', OLLAMA_WORKFLOW: 'draft' })).toMatchObject({ workflow: 'draft' });
  });

  it.each(['', 'semantic', 'SEMANTIC-PLAN', 'unknown'])('rejects invalid workflow selection %j', workflow => {
    expect(() => readProviderConfig({ API_PROVIDER: 'ollama', OLLAMA_WORKFLOW: workflow })).toThrow();
  });

  it('accepts local overrides and pins localhost to a literal loopback address', () => {
    expect(readProviderConfig({ API_PROVIDER: 'ollama', OLLAMA_BASE_URL: 'http://localhost:11435/',
      OLLAMA_MODEL: 'my-local-model:v1', OLLAMA_TIMEOUT_MS: '90000', OLLAMA_CONTEXT_SIZE: '4096',
      OLLAMA_MAX_OUTPUT_TOKENS: '512', OLLAMA_RESPONSE_LIMIT_BYTES: '8192',
    })).toMatchObject({ baseUrl: 'http://127.0.0.1:11435', model: 'my-local-model:v1', timeoutMs: 90000, contextSize: 4096, maxOutputTokens: 512, responseLimitBytes: 8192 });
    expect(readProviderConfig({ API_PROVIDER: 'ollama', OLLAMA_BASE_URL: 'http://[::1]:11434' })).toMatchObject({ baseUrl: 'http://[::1]:11434' });
    expect(readConfig({ API_HOST: 'localhost' }).host).toBe('127.0.0.1');
  });

  it.each(['openai', '', 'OLLAMA'])('rejects unsupported provider selection %j', provider => {
    expect(() => readProviderConfig({ API_PROVIDER: provider })).toThrow();
  });

  it.each([
    'http://0.0.0.0:11434', 'http://192.168.1.1:11434', 'https://ollama.com',
    'http://localhost.evil.example:11434', 'http://user:password@localhost:11434',
    'http://127.0.0.1:11434/api', 'http://127.0.0.1:11434/?key=private',
    'http://127.0.0.1:11434/#fragment', 'file:///tmp/ollama', 'http://127.0.0.1:0',
  ])('rejects non-loopback or ambiguous Ollama origin %s', baseUrl => {
    expect(() => readProviderConfig({ API_PROVIDER: 'ollama', OLLAMA_BASE_URL: baseUrl })).toThrow();
  });

  it.each(['', 'model with spaces', 'model\n', 'model:cloud', 'model-cloud:latest', 'model:4b-cloud'])(
    'rejects invalid/cloud model names %j', model => {
      expect(() => readProviderConfig({ API_PROVIDER: 'ollama', OLLAMA_MODEL: model })).toThrow();
    },
  );

  it.each([
    { OLLAMA_TIMEOUT_MS: '0' }, { OLLAMA_TIMEOUT_MS: '180001' },
    { OLLAMA_CONTEXT_SIZE: '2048' }, { OLLAMA_CONTEXT_SIZE: '32768' },
    { OLLAMA_MAX_OUTPUT_TOKENS: '-1' }, { OLLAMA_MAX_OUTPUT_TOKENS: '4097' },
    { OLLAMA_RESPONSE_LIMIT_BYTES: '4095' }, { OLLAMA_RESPONSE_LIMIT_BYTES: '262145' },
    { OLLAMA_CONTEXT_SIZE: '4096', OLLAMA_MAX_OUTPUT_TOKENS: '4096' },
  ])('rejects unbounded or inconsistent inference settings %#', values => {
    expect(() => readProviderConfig({ API_PROVIDER: 'ollama', ...values })).toThrow();
  });

  it.each(['0.0.0.0', '::', '192.168.1.2'])('prevents public API binding on %s', host => {
    expect(() => readConfig({ API_HOST: host })).toThrow();
  });
});
