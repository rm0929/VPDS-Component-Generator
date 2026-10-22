import { generateSpecification, GenerationClientError } from './generateSpecification';
import type { GenerateResponse, GenerationErrorCode } from './generateSpecification';
import type { UiSpecification } from '../specification/uiSpecification';

export type GenerationState =
  | { status: 'idle' | 'loading' | 'cancelled' }
  | { status: 'error' | 'unsupported'; code: GenerationErrorCode; message: string }
  | { status: 'success'; specification: UiSpecification; generation: number; requestId: string };
type Generate = (prompt: string, options: { signal: AbortSignal }) => Promise<GenerateResponse>;

/** One request owner per mounted view. Version checks also cover mocks ignoring abort. */
export function createGenerationRequests(onChange: (state: GenerationState) => void, request: Generate = generateSpecification) {
  let version = 0;
  let active: AbortController | undefined;
  const invalidate = () => { version++; active?.abort(); active = undefined; };
  return {
    async generate(prompt: string) {
      invalidate();
      const attempt = version;
      const controller = new AbortController();
      active = controller;
      onChange({ status: 'loading' }); // The previous specification is removed immediately.
      try {
        const result = await request(prompt, { signal: controller.signal });
        if (attempt !== version || controller.signal.aborted) return;
        if (result.meta.isMock || result.meta.provider !== 'ollama-local-flat-selection') throw new GenerationClientError('WRONG_PROVIDER');
        onChange({ status: 'success', specification: result.data.specification, generation: attempt, requestId: result.requestId });
      } catch (error) {
        if (attempt !== version || controller.signal.aborted) return;
        const failure = error instanceof GenerationClientError ? error : new GenerationClientError('CLIENT_FAILURE');
        if (failure.code === 'CANCELLED') onChange({ status: 'cancelled' });
        else onChange({ status: failure.code === 'UNSUPPORTED_UI_REQUEST' ? 'unsupported' : 'error', code: failure.code, message: failure.message });
      } finally {
        if (attempt === version) active = undefined;
      }
    },
    cancel() {
      if (!active) return;
      invalidate();
      onChange({ status: 'cancelled' });
    },
    // No terminal disposed flag: React StrictMode can clean up and reconnect effects.
    dispose: invalidate,
  };
}
