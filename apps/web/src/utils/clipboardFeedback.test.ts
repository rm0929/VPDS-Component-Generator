import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClipboardFeedback } from './clipboardFeedback';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function pendingWrite() {
  let resolve!: () => void; let reject!: (error: unknown) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('truthful clipboard feedback', () => {
  it('reports copying until the actual write resolves, then clears copied feedback', async () => {
    vi.useFakeTimers();
    const pending = pendingWrite(); const change = vi.fn(); const write = vi.fn().mockReturnValue(pending.promise);
    const clipboard = createClipboardFeedback(change, write);
    const copy = clipboard.copy('Complete TSX');
    expect(write).toHaveBeenCalledWith('Complete TSX'); expect(change.mock.calls).toEqual([['copying']]);
    pending.resolve(); await copy;
    expect(change.mock.calls.at(-1)).toEqual(['copied']);
    vi.advanceTimersByTime(1999); expect(change.mock.calls.at(-1)).toEqual(['copied']);
    vi.advanceTimersByTime(1); expect(change.mock.calls.at(-1)).toEqual(['idle']);
  });
  it('reports rejection without success or private error details and can retry', async () => {
    vi.useFakeTimers();
    const change = vi.fn(); const write = vi.fn().mockRejectedValueOnce(new Error('PRIVATE')).mockResolvedValue(undefined);
    const clipboard = createClipboardFeedback(change, write);
    await clipboard.copy('Code');
    expect(change.mock.calls).toEqual([['copying'], ['error']]);
    expect(vi.getTimerCount()).toBe(0);
    await clipboard.copy('Code'); expect(change.mock.calls.at(-1)).toEqual(['copied']); clipboard.dispose();
  });
  it('handles an unavailable browser clipboard as a failed copy', async () => {
    vi.stubGlobal('navigator', {});
    const change = vi.fn(); await createClipboardFeedback(change).copy('Code');
    expect(change.mock.calls).toEqual([['copying'], ['error']]);
  });
  it.each(['resolve', 'reject'] as const)('ignores a superseded copy %s and clears timers on disposal', async outcome => {
    vi.useFakeTimers(); const first = pendingWrite(); const next = pendingWrite(); const change = vi.fn();
    const clipboard = createClipboardFeedback(change, vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(next.promise));
    const old = clipboard.copy('Old'); const current = clipboard.copy('New');
    if (outcome === 'resolve') first.resolve(); else first.reject(new Error('PRIVATE'));
    await old; expect(change.mock.calls.at(-1)).toEqual(['copying']);
    next.resolve(); await current; expect(change.mock.calls.at(-1)).toEqual(['copied']);
    clipboard.dispose(); expect(vi.getTimerCount()).toBe(0);
  });
  it('ignores completion after unmount or code replacement', async () => {
    const pending = pendingWrite(); const change = vi.fn();
    const clipboard = createClipboardFeedback(change, () => pending.promise);
    const copy = clipboard.copy('Old'); clipboard.dispose(); pending.resolve(); await copy;
    expect(change.mock.calls).toEqual([['copying']]);
  });
});
