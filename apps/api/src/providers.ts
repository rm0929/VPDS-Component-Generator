import { createGroqProvider } from './ai/groqProvider';
import { mockProvider } from './mockProvider';
import { createOllamaProvider } from './ai/ollamaProvider';
import { readProviderConfig } from './providerConfig';
import type { GenerationProvider } from './provider';
import type { GenerationDiagnostics } from './diagnostics';

export function createConfiguredProvider(config = readProviderConfig(), diagnostics?: GenerationDiagnostics): GenerationProvider {
  if (config.provider === 'groq') return createGroqProvider(config, fetch, diagnostics);
  return config.provider === 'mock' ? mockProvider : createOllamaProvider(config, fetch, diagnostics);
}
