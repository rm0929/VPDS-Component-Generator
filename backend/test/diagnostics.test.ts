import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createGenerationDiagnostics } from '../src/diagnostics';

const enabled = { NODE_ENV: 'development', API_LOCAL_DIAGNOSTICS: 'true' };

describe('opt-in local failure diagnostics', () => {
  it.each([{}, { NODE_ENV: 'development' }, { API_LOCAL_DIAGNOSTICS: 'true' },
    { NODE_ENV: 'production', API_LOCAL_DIAGNOSTICS: 'true' },
    { NODE_ENV: 'test', API_LOCAL_DIAGNOSTICS: 'true' },
    { NODE_ENV: 'development', API_LOCAL_DIAGNOSTICS: 'false' },
    { NODE_ENV: 'development', API_LOCAL_DIAGNOSTICS: 'TRUE' }])(
    'stays silent unless explicitly enabled in development: %j', env => {
      const sink = vi.fn();
      createGenerationDiagnostics(env, sink)('ui_schema');
      expect(sink).not.toHaveBeenCalled();
    },
  );

  it('logs only safe stage/path/code and developer-owned messages, redacting record keys', () => {
    const sink = vi.fn();
    const result = z.object({ root: z.object({ props: z.record(z.string(), z.literal('SECRET-EXPECTED')) }) })
      .safeParse({ root: { props: { 'SECRET-KEY': 'SECRET-VALUE' } } });
    if (result.success) throw new Error('Expected invalid data');
    createGenerationDiagnostics(enabled, sink)('ui_schema', result.error.issues);
    expect(sink).toHaveBeenCalledWith({ stage: 'ui_schema', message: 'The model document failed authoritative UI validation.',
      issues: [{ path: ['root', 'props', '[redacted]'], code: 'invalid_value', message: 'A value is outside the permitted contract values.' }],
    });
    expect(JSON.stringify(sink.mock.calls)).not.toContain('SECRET');
  });

  it('does not echo unknown-key names or arbitrary custom issue messages/metadata', () => {
    const sink = vi.fn();
    const unrecognized = z.strictObject({}).safeParse({ 'SECRET-KEY': 'SECRET-VALUE' });
    const custom = z.unknown().superRefine((_value, ctx) => {
      ctx.addIssue({ code: 'custom', message: 'SECRET-MESSAGE', path: ['SECRET-PATH'], params: { value: 'SECRET-METADATA' } });
    }).safeParse('SECRET-INPUT');
    if (unrecognized.success || custom.success) throw new Error('Expected invalid data');
    const diagnose = createGenerationDiagnostics(enabled, sink);
    diagnose('ui_schema', [...unrecognized.error.issues, ...custom.error.issues]);
    expect(JSON.stringify(sink.mock.calls)).not.toContain('SECRET');
    expect(sink.mock.calls[0][0].issues).toEqual([
      { path: [], code: 'unrecognized_keys', message: 'An object contains unsupported properties.' },
      { path: ['[redacted]'], code: 'custom', message: 'A UI contract rule was violated.' },
    ]);
  });

  it('bounds diagnostic volume/path length and redacts non-index numbers and symbols', () => {
    const sink = vi.fn();
    const result = z.unknown().superRefine((_value, ctx) => {
      for (let index = 0; index < 30; index++) ctx.addIssue({ code: 'custom', message: 'Secret',
        path: [Symbol('Secret'), -1, 999999, ...Array<string>(30).fill('root')] });
    }).safeParse(null);
    if (result.success) throw new Error('Expected invalid data');
    createGenerationDiagnostics(enabled, sink)('ui_schema', result.error.issues);
    expect(sink.mock.calls[0][0].issues).toHaveLength(20);
    expect(sink.mock.calls[0][0].issues[0].path).toHaveLength(24);
    expect(sink.mock.calls[0][0].issues[0].path.slice(0, 3)).toEqual(['[redacted]', '[redacted]', '[redacted]']);
  });

  it('preserves the safe duplicate-ID explanation and ignores failed diagnostic sinks', () => {
    const sink = vi.fn();
    const result = z.unknown().superRefine((_value, ctx) => ctx.addIssue({ code: 'custom',
      path: ['root', 'children', 0, 'id'], message: 'Component IDs must be unique' })).safeParse(null);
    if (result.success) throw new Error('Expected invalid data');
    createGenerationDiagnostics(enabled, sink)('ui_schema', result.error.issues);
    expect(sink.mock.calls[0][0].issues[0].message).toBe('Component IDs must be unique.');
    expect(() => createGenerationDiagnostics(enabled, () => { throw new Error('SECRET'); })('model_json')).not.toThrow();
  });
});
