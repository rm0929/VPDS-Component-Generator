import { describe, expect, it, vi } from 'vitest';
import { resolve } from 'node:path';
import { buildSemanticModelInstructions, buildSemanticModelSchema } from '../src/semanticModelSchema';
import { semanticExperimentMessages, semanticSourceMetadata, UI_ONLY_INTERPRETATION } from '../evaluation/semanticPromptExperiments';
import { summarizeSemanticExperiment } from '../evaluation/semanticExperimentMetrics';
import { evaluationProvider } from '../evaluation/evaluationProvider';
import { compareExperiments } from '../evaluation/compareExperiments';
import type { ExperimentRun } from '../evaluation/compareExperiments';
import { evaluationCases } from '../evaluation/evaluateGeneration';
import { challengeCases } from '../evaluation/challengeCases';
import { scoreBenchmark } from '../evaluation/compositionMetrics';
import { readProviderConfig } from '../src/providerConfig';
import { compileSemanticUiPlan } from '../src/compileSemanticUiPlan';
import { hash } from '../evaluation/metadata';
import { profilePlan } from './fixtures/semantic-plans';
import manifest from '../evaluation/fixtures/semantic-manifest-v1.json';
import originalManifest from '../evaluation/fixtures/frozen-manifest.json';

const config = () => {
  const value = readProviderConfig({ API_PROVIDER: 'ollama', OLLAMA_WORKFLOW: 'semantic-plan' });
  if (value.provider !== 'ollama') throw new Error('Expected local Ollama');
  return value;
};
const json = (value: unknown) => new Response(JSON.stringify({ done: true, message: { role: 'assistant', content: JSON.stringify(value) } }));
const profileCase = challengeCases.find(item => item.id === 'c-profile')!;
const good = () => ({ run: 1, ...scoreBenchmark(profileCase, compileSemanticUiPlan(profilePlan())), durationMs: 20 });

describe('isolated semantic UI-only interpretation experiment', () => {
  it('freezes the runtime baseline, semantic grammar and compiler without changing the original dataset', () => {
    expect(semanticExperimentMessages('baseline')).toEqual([{ role: 'system', content: buildSemanticModelInstructions() }]);
    expect(hash(JSON.stringify(semanticExperimentMessages('baseline')))).toBe(manifest.baselinePromptHash);
    expect(hash(JSON.stringify(buildSemanticModelSchema()))).toBe(manifest.schemaHash);
    expect(semanticSourceMetadata(resolve(__dirname, '../..'))).toMatchObject({ semanticCompilerRevision: manifest.semanticCompilerRevision });
    expect(manifest.datasetHash).toBe(originalManifest.datasetHash);
    expect(hash(JSON.stringify([...evaluationCases, ...challengeCases]))).toBe(originalManifest.datasetHash);
  });

  it('adds only a prominent general interpretation policy to the frozen baseline', () => {
    const messages = semanticExperimentMessages('ui-only-interpretation-v1');
    expect(messages).toEqual([{ role: 'system', content: `${UI_ONLY_INTERPRETATION}\n\n${buildSemanticModelInstructions()}` }]);
    expect(hash(JSON.stringify(messages))).toBe(manifest.variantPromptHash);
    for (const rule of ['React TSX', 'only SemanticUiPlan JSON', 'not backend business logic', 'Button labels',
      'persistence, authentication, navigation or destructive actions', 'button, submit and reset',
      'Only explicitly requested', 'unsupported-behavior', 'unsupported-component', 'Never silently omit']) expect(UI_ONLY_INTERPRETATION).toContain(rule);
    for (const text of ['profile', 'Save Profile', 'Login', 'registration', 'contact']) expect(UI_ONLY_INTERPRETATION).not.toContain(text);
    for (const item of [...evaluationCases, ...challengeCases]) expect(UI_ONLY_INTERPRETATION).not.toContain(item.prompt);
    messages[0].content = 'Caller mutation';
    expect(hash(JSON.stringify(semanticExperimentMessages('baseline')))).toBe(manifest.baselinePromptHash);
    expect(hash(JSON.stringify(semanticExperimentMessages('ui-only-interpretation-v1')))).toBe(manifest.variantPromptHash);
  });

  it('changes only trusted messages while retaining format, options, cancellation and semantic compilation', async () => {
    const request = vi.fn<typeof fetch>().mockImplementation(async () => json(profilePlan()));
    for (const variant of ['baseline', 'ui-only-interpretation-v1'] as const) {
      const provider = evaluationProvider(config(), semanticExperimentMessages(variant), () => {}, request);
      expect(await provider.generate('Developer-owned UI request', { signal: new AbortController().signal })).toEqual(compileSemanticUiPlan(profilePlan()));
    }
    expect(request).toHaveBeenCalledTimes(2);
    const bodies = request.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
    const { messages: previousMessages, ...previousOptions } = bodies[0];
    const { messages: nextMessages, ...nextOptions } = bodies[1];
    expect(nextOptions).toEqual(previousOptions);
    expect(nextOptions.format).toEqual(buildSemanticModelSchema());
    expect(nextOptions.options).toMatchObject({ temperature: 0, seed: 0, num_ctx: 8192, num_predict: 2048 });
    expect(previousMessages).toEqual([...semanticExperimentMessages('baseline'), { role: 'user', content: 'Developer-owned UI request' }]);
    expect(nextMessages).toEqual([...semanticExperimentMessages('ui-only-interpretation-v1'), { role: 'user', content: 'Developer-owned UI request' }]);
    for (const [, init] of request.mock.calls) expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each(['baseline', 'ui-only-interpretation-v1'] as const)('retains refusal and strict plan validation in %s', async variant => {
    const invalid = profilePlan(); invalid.content = [{ group: 99 }];
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ planVersion: '1', status: 'unsupported', reason: 'unsupported-behavior' }))
      .mockResolvedValueOnce(json(invalid));
    const diagnose = vi.fn();
    const provider = evaluationProvider(config(), semanticExperimentMessages(variant), diagnose, request);
    await expect(provider.generate('Explicit unsupported behavior request', { signal: new AbortController().signal })).rejects.toMatchObject({ code: 'UNSUPPORTED_UI_REQUEST' });
    await expect(provider.generate('UI request', { signal: new AbortController().signal })).rejects.toMatchObject({ code: 'INVALID_PROVIDER_OUTPUT' });
    expect(diagnose.mock.calls.map(([stage]) => stage)).toEqual(['unsupported_request', 'semantic_plan']);
    expect(request).toHaveBeenCalledTimes(2);
  });
});

describe('separate refusal and layout accuracy measurements', () => {
  it('distinguishes false refusals, correct refusals, false acceptance and infrastructure failures', () => {
    const unsupported = evaluationCases.find(item => item.id === 'unsupported-behavior')!;
    const results = [good(), { run: 2, ...scoreBenchmark(profileCase, undefined, 'UNSUPPORTED_UI_REQUEST'), durationMs: 10 },
      { run: 1, ...scoreBenchmark(unsupported, undefined, 'UNSUPPORTED_UI_REQUEST'), durationMs: 10 },
      { run: 2, ...scoreBenchmark(unsupported, compileSemanticUiPlan(profilePlan())), durationMs: 10 },
      { run: 3, ...scoreBenchmark(unsupported, undefined, 'GENERATION_TIMEOUT'), durationMs: 10 }];
    expect(summarizeSemanticExperiment(results).classification).toEqual({ supportedAttempts: 2, falseUnsupportedCount: 1,
      falseUnsupportedRate: .5, unsupportedAttempts: 3, correctUnsupportedCount: 1, correctUnsupportedRate: 1 / 3,
      falseAcceptanceCount: 1, otherUnsupportedFailures: 1 });
  });

  it('counts invalid outputs as unassessed layout checks and includes them in the accuracy denominator', () => {
    const bad = { run: 2, ...scoreBenchmark(profileCase, undefined, 'INVALID_PROVIDER_OUTPUT'), durationMs: 30 };
    expect(summarizeSemanticExperiment([good(), bad]).layoutAccuracy).toEqual({ expectedChecks: 6, assessedChecks: 3,
      passedChecks: 3, unassessedChecks: 3, checkPassRate: .5, relationshipAttempts: 2, accurateAttempts: 1, completeRelationshipRate: .5 });
  });

  it('reports failed relationships independently of positive component coverage', () => {
    const input = profilePlan(); input.groups[1].members.reverse();
    const result = { run: 1, ...scoreBenchmark(profileCase, compileSemanticUiPlan(input)), durationMs: 20 };
    expect(result).toMatchObject({ schemaValid: true, requirementCoverage: 1, completeCoverage: false });
    expect(summarizeSemanticExperiment([result]).layoutAccuracy).toMatchObject({ expectedChecks: 3, passedChecks: 2, checkPassRate: 2 / 3, completeRelationshipRate: 0 });
    expect(summarizeSemanticExperiment([]).layoutAccuracy.checkPassRate).toBeNull();
  });

  it('preserves established retention gates and refuses mixed workflows or semantic compiler versions', () => {
    const run = (): ExperimentRun => ({ metadata: { variant: 'baseline', workflow: 'semantic-plan', datasetHash: 'dataset', schemaHash: 'schema',
      compilerRevision: 'compiler', semanticCompilerRevision: 'semantic', evaluationRevision: 'scorer', modelDigest: 'model', ollamaVersion: 'runtime',
      settings: { repeats: 1 }, evaluatedCaseIds: [profileCase.id] }, results: [good()] });
    const baseline = run(), candidate = run();
    expect(compareExperiments(baseline, candidate)).toMatchObject({ retain: true, semanticMetrics: {
      before: { classification: { falseUnsupportedCount: 0 } }, after: { layoutAccuracy: { checkPassRate: 1 } },
    } });
    candidate.metadata.workflow = 'draft';
    expect(() => compareExperiments(baseline, candidate)).toThrow('different frozen inputs');
    candidate.metadata.workflow = 'semantic-plan'; candidate.metadata.semanticCompilerRevision = 'changed';
    expect(() => compareExperiments(baseline, candidate)).toThrow('different frozen inputs');
    candidate.metadata.semanticCompilerRevision = 'semantic';
    candidate.results = [{ run: 1, ...scoreBenchmark(profileCase, undefined, 'UNSUPPORTED_UI_REQUEST'), durationMs: 10 }];
    expect(compareExperiments(baseline, candidate)).toMatchObject({ retain: false,
      reasons: expect.arrayContaining(['schemaValidityRate decreased', 'Core case regressed: c-profile']),
      semanticMetrics: { after: { classification: { falseUnsupportedRate: 1 } } },
    });
  });
});
