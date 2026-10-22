import { describe, expect, it, vi } from 'vitest';
import { createGenerationRequests } from './generationRequests';
import type { GenerationState } from './generationRequests';
import { GenerationClientError } from './generateSpecification';
import type { GenerateResponse } from './generateSpecification';
import { uiSpecificationSchema } from '@vpds/ui-specification/uiSpecification';

const result = (content = 'Example'): GenerateResponse => ({ data: { specification: uiSpecificationSchema.parse({ version: '1.0',
  root: { id: 'root', type: 'text', props: { content } } }) }, meta: { provider: 'ollama-local-flat-selection', isMock: false }, requestId: 'request' });
function deferred() {
  let resolve!: (value: GenerateResponse) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<GenerateResponse>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('generation request ownership and races', () => {
  it('removes the previous output while loading and uses a new generation key for identical output', async () => {
    const states: GenerationState[] = [];
    const requests = createGenerationRequests(state => states.push(state), async () => result());
    await requests.generate('First'); await requests.generate('Next');
    expect(states.map(state => state.status)).toEqual(['loading', 'success', 'loading', 'success']);
    expect(states[2]).toEqual({ status: 'loading' });
    expect(states[1]).toMatchObject({ generation: 1 }); expect(states[3]).toMatchObject({ generation: 2 });
  });

  it.each(['resolve', 'reject'] as const)('ignores stale %s after a newer success, even if HTTP ignores abort', async outcome => {
    const old = deferred(); const next = deferred(); const states: GenerationState[] = [];
    const request = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    const requests = createGenerationRequests(state => states.push(state), request);
    const first = requests.generate('Old'); const second = requests.generate('New');
    expect(request.mock.calls[0][1].signal.aborted).toBe(true);
    next.resolve(result('New')); await second;
    const count = states.length;
    if (outcome === 'resolve') old.resolve(result('Old')); else old.reject(new Error('PRIVATE stale error'));
    await first;
    expect(states).toHaveLength(count);
    expect(states.at(-1)).toMatchObject({ status: 'success', specification: result('New').data.specification });
  });

  it('ignores stale finalizers so cancel still aborts the newer request', async () => {
    const old = deferred(); const next = deferred(); const states: GenerationState[] = [];
    const request = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    const requests = createGenerationRequests(state => states.push(state), request);
    const first = requests.generate('Old'); const second = requests.generate('New');
    old.resolve(result()); await first;
    expect(states.at(-1)).toEqual({ status: 'loading' });
    requests.cancel();
    expect(request.mock.calls[1][1].signal.aborted).toBe(true);
    expect(states.at(-1)).toEqual({ status: 'cancelled' });
    next.resolve(result()); await second;
    expect(states.at(-1)).toEqual({ status: 'cancelled' });
  });

  it.each(['resolve', 'reject'] as const)('aborts on unmount and ignores late %s', async outcome => {
    const pending = deferred(); const change = vi.fn();
    const request = vi.fn().mockReturnValue(pending.promise);
    const requests = createGenerationRequests(change, request);
    const generation = requests.generate('Example'); requests.dispose();
    expect(request.mock.calls[0][1].signal.aborted).toBe(true);
    if (outcome === 'resolve') pending.resolve(result()); else pending.reject(new Error('PRIVATE'));
    await generation;
    expect(change).toHaveBeenCalledTimes(1);
  });

  it('supports StrictMode effect cleanup/reconnection and recovery after cancellation', async () => {
    const states: GenerationState[] = [];
    const requests = createGenerationRequests(state => states.push(state), async () => result());
    requests.dispose();
    const first = requests.generate('First'); requests.cancel(); await first;
    await requests.generate('Next');
    expect(states.map(state => state.status)).toEqual(['loading', 'cancelled', 'loading', 'success']);
  });

  it.each([
    [new GenerationClientError('UNSUPPORTED_UI_REQUEST'), 'unsupported'],
    [new GenerationClientError('GENERATION_TIMEOUT'), 'error'],
    [new GenerationClientError('NETWORK_ERROR'), 'error'],
    [new Error('PRIVATE implementation fault'), 'error'],
  ])('reports safe failure state %#', async (failure, status) => {
    const change = vi.fn();
    const requests = createGenerationRequests(change, async () => { throw failure; });
    await requests.generate('Example');
    expect(change.mock.calls.at(-1)?.[0]).toMatchObject({ status });
    expect(JSON.stringify(change.mock.calls)).not.toContain('PRIVATE');
  });

  it.each([{ provider: 'deterministic-mock', isMock: true }, { provider: 'ollama-local', isMock: false },
    { provider: 'ollama-local-semantic-plan', isMock: false }])('never presents $provider output as flat-selection AI', async meta => {
    const change = vi.fn();
    await createGenerationRequests(change, async () => ({ ...result(), meta })).generate('Example');
    expect(change.mock.calls.at(-1)?.[0]).toMatchObject({ status: 'error', code: 'WRONG_PROVIDER' });
  });
});
