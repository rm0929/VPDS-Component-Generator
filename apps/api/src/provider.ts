import { ApiError } from './errors';

/** Output remains unknown until the API validates it with the shared UI schema. */
export interface GenerationProvider {
  readonly id: string;
  readonly isMock: boolean;
  /** Local inference can need a longer deadline than the deterministic mock. */
  readonly timeoutMs?: number;
  generate(prompt: string, options: { signal: AbortSignal }): Promise<unknown>;
}

export async function generateWithTimeout(
  provider: GenerationProvider, prompt: string, timeoutMs: number, disconnected: AbortSignal,
): Promise<unknown> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onDisconnect = () => {};
  const interruption = new Promise<never>((_, reject) => {
    const interrupt = (code: 'GENERATION_TIMEOUT' | 'PROVIDER_FAILURE') => {
      reject(new ApiError(code));
      controller.abort();
    };
    onDisconnect = () => interrupt('PROVIDER_FAILURE');
    if (disconnected.aborted) onDisconnect();
    else disconnected.addEventListener('abort', onDisconnect, { once: true });
    timer = setTimeout(() => interrupt('GENERATION_TIMEOUT'), timeoutMs);
  });
  try {
    return await Promise.race([
      interruption,
      Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return provider.generate(prompt, { signal: controller.signal });
      }),
    ]);
  } finally {
    clearTimeout(timer);
    disconnected.removeEventListener('abort', onDisconnect);
  }
}
