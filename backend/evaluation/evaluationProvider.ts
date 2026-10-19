import { createOllamaProvider } from '../src/ollamaProvider';
import type { OllamaConfig } from '../src/providerConfig';
import type { GenerationDiagnostics } from '../src/diagnostics';

export type PromptMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/** Manual experiment seam: change only trusted messages, preserving HTTP/compile safeguards. */
export function evaluationProvider(config: OllamaConfig, messages: readonly PromptMessage[], diagnostics: GenerationDiagnostics,
  request: typeof fetch = fetch) {
  const experimentRequest: typeof fetch = (url, init) => {
    const body = JSON.parse(String(init?.body));
    body.messages = [...messages, body.messages.at(-1)];
    return request(url, { ...init, body: JSON.stringify(body) });
  };
  return createOllamaProvider(config, experimentRequest, diagnostics);
}
