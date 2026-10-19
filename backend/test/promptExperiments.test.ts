import { describe, expect, it } from 'vitest';
import { compareExperiments } from '../evaluation/compareExperiments';
import type { ExperimentRun } from '../evaluation/compareExperiments';
import { experimentMessages, PROMPT_VARIANTS } from '../evaluation/promptExperiments';
import { evaluationCases } from '../evaluation/evaluateGeneration';
import { challengeCases } from '../evaluation/challengeCases';
import { scoreBenchmark } from '../evaluation/compositionMetrics';
import { compileModelUi } from '../src/compileModelUi';
import baseline from '../evaluation/fixtures/baseline-prompt-v1.json';
import { CONCISE_PROMPT } from '../evaluation/concisePrompt';
import { hash } from '../evaluation/metadata';
import { COMPONENT_TYPES } from '../../src/specification/componentRegistry';

describe('isolated prompt experiments', () => {
  it.each([
    ['baseline', '01218ad4d34227692d55df2cf0f91f9f7dc3c6b9d86652667527798e4f2a01ca'],
    ['deduplicated', 'cde1903e47ce0cf27000a057e071bd70c1ac1754a9b6c7ee07cd7ec07ea0005b'],
    ['layout', 'ddb6d611d56d6b90acdbd0b1c3cad6eb60930d8207e36f1e031ebd64f2905c9f'],
    ['examples', '89272408e8cfcfb3a5fd228dacc6b3a8820b115352136aa62b619210cc3cc3ef'],
    ['negation', '768f6b85b064160be14cf373fc96288fb715197a0c4f96085f00a44520b88b09'],
  ] as const)('preserves the previously evaluated %s messages', (variant, fingerprint) => {
    expect(hash(JSON.stringify(experimentMessages(variant)))).toBe(fingerprint);
  });
  it('freezes one concise replacement message without inheriting examples or copying evaluation requests', () => {
    const messages = experimentMessages('concise-v1');
    expect(messages).toEqual([{ role: 'system', content: CONCISE_PROMPT }]);
    expect(hash(JSON.stringify(messages))).toBe('4b29aa0742b5c86ff1e8d1c2c9ef51e53b5662e3227d9fe4b7f6d0b5d439725e');
    expect(CONCISE_PROMPT.length).toBeLessThan(baseline.map(item => item.content).join('\n').length * .6);
    for (const type of COMPONENT_TYPES) expect(CONCISE_PROMPT).toContain(type);
    for (const item of [...evaluationCases, ...challengeCases]) expect(CONCISE_PROMPT).not.toContain(item.prompt);
    messages[0].content = 'Changed by a caller';
    expect(experimentMessages('concise-v1')[0].content).toBe(CONCISE_PROMPT);
  });
  it('preserves the frozen baseline and never mutates shared messages', () => {
    expect(experimentMessages('baseline')).toEqual(baseline);
    for (const variant of PROMPT_VARIANTS) experimentMessages(variant);
    const changed = experimentMessages('baseline');
    changed[0].content = 'Mutated';
    expect(experimentMessages('baseline')).toEqual(baseline);
  });
  it('removes only the duplicated system example and retains the conversation example', () => {
    const messages = experimentMessages('deduplicated');
    expect(messages).toHaveLength(3);
    expect(messages.slice(1)).toEqual(baseline.slice(1));
    expect(messages[0].content).not.toContain('Complete worked example');
    expect(messages[0].content).toContain('Non-form example:');
  });
  it('isolates layout and negation guidance from every other experimental change', () => {
    const layout = experimentMessages('layout');
    const negation = experimentMessages('negation');
    expect(layout.slice(1)).toEqual(baseline.slice(1));
    expect(negation.slice(1)).toEqual(baseline.slice(1));
    expect(layout[0].content).toContain('renderer already supplies their labels');
    expect(layout[0].content).not.toContain('Positive and negative requirements:');
    expect(negation[0].content).toContain('Retain ALL positively requested');
    expect(negation[0].content).not.toContain('Layout composition:');
  });
  it('uses compilable diverse demonstrations without copying evaluation requests', () => {
    const messages = experimentMessages('examples');
    expect(messages.slice(0, 3)).toEqual(baseline);
    expect(messages).toHaveLength(9);
    const prompts = [...evaluationCases, ...challengeCases].map(item => item.prompt);
    for (let index = 3; index < messages.length; index += 2) {
      expect(prompts).not.toContain(messages[index].content);
      expect(messages[index].role).toBe('user');
      expect(messages[index + 1].role).toBe('assistant');
      expect(() => compileModelUi(JSON.parse(messages[index + 1].content))).not.toThrow();
    }
  });
});

function run(): ExperimentRun {
  const testCase = challengeCases.find(item => item.id === 'c-ui-only-login')!;
  const output = compileModelUi({ irVersion: '1', status: 'supported', root: { type: 'form', props: { label: 'Login' }, children: [
    { type: 'emailInput', props: { label: 'Email' } }, { type: 'passwordInput', props: { label: 'Password' } },
    { type: 'button', props: { label: 'Login', type: 'submit' } },
  ] } });
  return { metadata: { variant: 'baseline', datasetHash: 'dataset', schemaHash: 'schema', compilerRevision: 'compiler',
    evaluationRevision: 'scorer', modelDigest: 'digest', ollamaVersion: 'version', settings: { repeats: 1 }, evaluatedCaseIds: [testCase.id] },
  results: [{ run: 1, ...scoreBenchmark(testCase, output), durationMs: 10 }] };
}

describe('frozen comparison and conservative retention gates', () => {
  it('accepts equal quality and reports latency separately', () => {
    const baseline = run(), candidate = run();
    candidate.results[0].durationMs = 999;
    expect(compareExperiments(baseline, candidate)).toMatchObject({ retain: true, reasons: [], regressions: [], improvements: [] });
  });
  it('rejects semantic/core regressions even when structure still validates', () => {
    const candidate = run();
    Object.assign(candidate.results[0], { completeCoverage: false, matched: 3, passed: false, requirementCoverage: .75 });
    expect(compareExperiments(run(), candidate)).toMatchObject({ retain: false, regressions: ['c-ui-only-login'],
      reasons: expect.arrayContaining(['completeCoverageRate decreased', 'requirementCoverageRate decreased', 'Core case regressed: c-ui-only-login']) });
    expect(compareExperiments(run(), candidate).perCase).toMatchObject([{ caseId: 'c-ui-only-login',
      before: { schemaValidityRate: 1, completeCoverageRate: 1, requirementCoverageRate: 1 },
      after: { schemaValidityRate: 1, completeCoverageRate: 0, requirementCoverageRate: .75 },
      decreasedQualityMetrics: ['completeCoverageRate', 'requirementCoverageRate'],
    }]);
  });
  it('rejects extra layout wrappers and forbidden controls independently', () => {
    const candidate = run();
    candidate.results[0].composition!.layout.count++;
    candidate.results[0].composition!.forbiddenViolations.push('no-checkbox');
    expect(compareExperiments(run(), candidate)).toMatchObject({ retain: false,
      reasons: expect.arrayContaining(['Forbidden-component violations increased', 'Layout meanCount worsened']) });
    expect(compareExperiments(run(), candidate).perCase[0].increasedLayoutMetrics).toEqual(['meanCount']);
  });
  it('reveals structural regressions even when a case already failed complete coverage', () => {
    const baseline = run(), candidate = run();
    Object.assign(baseline.results[0], { completeCoverage: false, passed: false });
    const testCase = challengeCases.find(item => item.id === 'c-ui-only-login')!;
    candidate.results = [{ run: 1, ...scoreBenchmark(testCase, undefined, 'INVALID_PROVIDER_OUTPUT'), durationMs: 50 }];
    const comparison = compareExperiments(baseline, candidate);
    expect(comparison.regressions).toEqual([]);
    expect(comparison.perCase[0].decreasedQualityMetrics).toEqual(['schemaValidityRate', 'requirementCoverageRate']);
    expect(comparison.perCase[0]).toMatchObject({ before: { layout: { assessed: 1 } }, after: { layout: { assessed: 0, unassessed: 1 } } });
  });
  it('refuses to compare changed datasets, compilers, settings, or missing attempts', () => {
    const candidate = run();
    candidate.metadata.settings = { repeats: 2 };
    expect(() => compareExperiments(run(), candidate)).toThrow('different frozen inputs');
    candidate.metadata = run().metadata;
    candidate.results = [];
    expect(() => compareExperiments(run(), candidate)).toThrow('missing or duplicate');
  });
});
