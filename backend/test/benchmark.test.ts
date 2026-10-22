import { describe, expect, it } from 'vitest';
import { compileModelUi, ModelUiCompilationError } from '../src/compileModelUi';
import { createGenerationDiagnostics } from '../src/diagnostics';
import type { DiagnosticEntry } from '../src/diagnostics';
import { BASE_COMPONENT_TYPES as COMPONENT_TYPES } from '../../src/specification/componentRegistry';
import { evaluationCases } from '../evaluation/evaluateGeneration';
import { challengeCases } from '../evaluation/challengeCases';
import { analyzeComposition, scoreBenchmark } from '../evaluation/compositionMetrics';
import { summarizeBenchmark } from '../evaluation/benchmark';
import { hash, sourceMetadata } from '../evaluation/metadata';
import legacy from '../evaluation/fixtures/legacy-v1.json';
import challenge from '../evaluation/fixtures/challenge-v1.json';
import manifest from '../evaluation/fixtures/frozen-manifest.json';
import baseline from '../evaluation/fixtures/baseline-prompt-v1.json';
import { buildModelInstructions, buildModelSchema } from '../src/modelSchema';
import { resolve } from 'node:path';
import type { DraftNode } from '../src/modelUiDraft';

const field = (label: string): DraftNode => ({ type: 'textInput', props: { label } });
const layout = (type: 'verticalLayout' | 'horizontalLayout', children: DraftNode[]): DraftNode & { children: DraftNode[] } => ({ type, props: {}, children });
const compile = (root: unknown) => compileModelUi({ irVersion: '1', status: 'supported', root });
const profileCase = challengeCases.find(item => item.id === 'c-profile')!;
const profile = (): DraftNode & { children: (DraftNode & { children: DraftNode[] })[] } => ({ type: 'form', props: { label: 'Profile' }, children: [layout('verticalLayout', [
  layout('horizontalLayout', [field('First name'), field('Last name')]),
  { type: 'emailInput', props: { label: 'Email' } }, { type: 'button', props: { label: 'Save Profile', type: 'submit' } },
])] });

describe('frozen baseline and versioned challenge expectations', () => {
  it('preserves the original eleven cases byte-for-byte as JSON data', () => {
    expect(evaluationCases).toEqual(legacy);
    expect(legacy).toHaveLength(11);
  });
  it('locks challenge expectations and aggregate dataset hash', () => {
    expect(challengeCases).toEqual(challenge);
    expect(hash(JSON.stringify([...evaluationCases, ...challengeCases]))).toBe(manifest.datasetHash);
    expect(new Set([...evaluationCases, ...challengeCases].map(item => item.id)).size).toBe(29);
  });
  it('covers all ten component types and validates relationship references', () => {
    const types = new Set(challengeCases.flatMap(item => item.expected === 'supported' ? item.expectation.requirements.map(req => req.type) : []));
    expect([...types].sort()).toEqual([...COMPONENT_TYPES].sort());
    for (const item of challengeCases) {
      if (item.expected !== 'supported') continue;
      const keys = item.expectation.requirements.map(req => req.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const rule of item.relationships ?? []) {
        const refs = rule.kind === 'children' ? [rule.parent, ...rule.children] : [rule.first, rule.second];
        for (const ref of refs) expect(keys).toContain(ref);
      }
    }
  });
  it('preserves archived schema, compiler identity, and prompt without mislabeling the expanded compiler as the old revision', () => {
    expect(hash(JSON.stringify(buildModelSchema()))).toBe(manifest.schemaHash);
    expect(hash(JSON.stringify(baseline))).toBe(manifest.baselinePromptHash);
    expect(baseline[0].content).toBe(buildModelInstructions());
    // Keep the historical manifest intact. New component compilation is a new
    // revision; its measurements must never be presented as the old benchmark.
    expect(manifest.compilerRevision).toBe('403d1d24115f027e26a28dd686b1458239d4776b3a3143a397c5a386573da49d');
    expect(sourceMetadata(resolve(__dirname, '../..')).compilerRevision).not.toBe(manifest.compilerRevision);
  });
});

describe('direct layout relationships, ordering and forbidden components', () => {
  it('reproduces the observed profile validation path with a developer-authored malformed tree', () => {
    const entries: DiagnosticEntry[] = [];
    const diagnose = createGenerationDiagnostics({ NODE_ENV: 'development', API_LOCAL_DIAGNOSTICS: 'true' }, entry => entries.push(entry));
    // Synthetic regression data, not a saved model response. The observed action had no form ancestor.
    const root = layout('verticalLayout', [layout('horizontalLayout', [field('First name'), field('Last name'),
      { type: 'button', props: { label: 'Save Profile', type: 'submit' } },
    ])]);
    try { compile(root); throw new Error('Expected authoritative validation to reject the action'); }
    catch (error) {
      expect(error).toBeInstanceOf(ModelUiCompilationError);
      if (!(error instanceof ModelUiCompilationError)) throw error;
      expect(error.stage).toBe('ui_schema');
      diagnose(error.stage, error.issues);
    }
    expect(entries).toEqual([{ stage: 'ui_schema', message: 'The model document failed authoritative UI validation.',
      issues: [{ path: ['root', 'children', 0, 'children', 2], code: 'custom', message: 'Submit/reset buttons require a form ancestor.' }] }]);
    expect(JSON.stringify(entries)).not.toContain('Save Profile');
  });
  it('accepts the canonical profile without forcing one exact whole-document shape', () => {
    expect(scoreBenchmark(profileCase, compile(profile()))).toMatchObject({ schemaValid: true, completeCoverage: true,
      composition: { failedRelationships: [], layoutWithinBudget: true } });
    const input = profile();
    input.children = [input.children[0].children[0], ...input.children[0].children.slice(1)] as typeof input.children;
    expect(scoreBenchmark(profileCase, compile(input)).passed).toBe(true);
  });
  it('rejects splitting first and last names across different rows despite both having row ancestors', () => {
    const input = profile();
    input.children[0].children[0] = layout('horizontalLayout', [field('First name')]);
    input.children[0].children.splice(1, 0, layout('horizontalLayout', [field('Last name')]));
    expect(scoreBenchmark(profileCase, compile(input))).toMatchObject({ schemaValid: true, completeCoverage: false,
      composition: { failedRelationships: ['names-same-row'] } });
  });
  it('rejects reversed direct siblings', () => {
    const input = profile();
    const row = input.children[0].children[0];
    if (!row.children) throw new Error('Expected row');
    row.children.reverse();
    expect(analyzeComposition(profileCase, compile(input))?.failedRelationships).toEqual(['names-same-row']);
  });
  it('rejects indirect descendants where direct children were requested', () => {
    const input = profile();
    input.children[0].children[0] = layout('horizontalLayout', [layout('verticalLayout', [field('First name')]), field('Last name')]);
    expect(analyzeComposition(profileCase, compile(input))?.failedRelationships).toEqual(['names-same-row']);
  });
  it('does not treat an email inside a row as below that row', () => {
    const input = profile();
    const row = input.children[0].children[0];
    if (!row.children) throw new Error('Expected row');
    row.children.push(input.children[0].children.splice(1, 1)[0]);
    expect(analyzeComposition(profileCase, compile(input))?.failedRelationships).toContain('row-before-email');
  });
  it('can select the correct row among multiple candidate parent layouts', () => {
    const input = profile();
    input.children[0].children.unshift(layout('horizontalLayout', [{ type: 'text', props: { content: 'Other' } }]));
    expect(scoreBenchmark(profileCase, compile(input)).completeCoverage).toBe(true);
  });
  it('fails forbidden-component constraints without conflating them with missing required controls', () => {
    const testCase = challengeCases.find(item => item.id === 'c-negation-login')!;
    const root = { type: 'form', props: { label: 'Login' }, children: [
      { type: 'emailInput', props: { label: 'Email' } }, { type: 'passwordInput', props: { label: 'Password' } },
      { type: 'button', props: { label: 'Login', type: 'submit' } },
    ] };
    expect(scoreBenchmark(testCase, compile(root)).completeCoverage).toBe(true);
    const bad = { ...root, children: [...root.children, { type: 'heading', props: { content: 'Extra', level: 2 } }] };
    expect(scoreBenchmark(testCase, compile(bad))).toMatchObject({ schemaValid: true, requirementCoverage: 1,
      completeCoverage: false, composition: { forbiddenViolations: ['no-heading'] } });
  });
  it('counts repeated requested controls distinctly', () => {
    const testCase = challengeCases.find(item => item.id === 'c-repeated-fields')!;
    const root = { type: 'form', props: { label: 'Verify' }, children: [field('Code'), field('Code'), { type: 'button', props: { label: 'Verify', type: 'submit' } }] };
    expect(scoreBenchmark(testCase, compile(root)).passed).toBe(true);
    root.children.splice(0, 1);
    expect(scoreBenchmark(testCase, compile(root)).completeCoverage).toBe(false);
  });
});

describe('separate layout complexity and latency metrics', () => {
  it('counts DSL layout nodes, excluding form containers and renderer-owned field wrappers', () => {
    expect(analyzeComposition(profileCase, compile(profile()))?.layout).toEqual({ count: 2, depth: 2, singleChild: 0, repeatedDirectionEdges: 0, longestSameDirectionChain: 1 });
    expect(analyzeComposition(challengeCases[0], compile(field('Name')))?.layout.count).toBe(0);
  });
  it('reports unary/repeated layout chains without modifying output or semantic coverage', () => {
    const input = profile();
    input.children[0] = layout('verticalLayout', [input.children[0]]) as typeof input.children[0];
    const output = compile(input);
    const saved = structuredClone(output);
    const result = scoreBenchmark(profileCase, output);
    expect(result.completeCoverage).toBe(true);
    expect(result.composition).toMatchObject({ layoutWithinBudget: false,
      layout: { count: 3, depth: 3, singleChild: 1, repeatedDirectionEdges: 1, longestSameDirectionChain: 2 } });
    expect(output).toEqual(saved);
  });
  it('returns unassessed complexity for invalid output instead of a misleading zero', () => {
    expect(analyzeComposition(profileCase, {})).toBeNull();
    const result = { run: 1, ...scoreBenchmark(profileCase, {}), durationMs: 1000 };
    expect(summarizeBenchmark([result])).toMatchObject({ schemaValidityRate: 0, layout: { assessed: 0, unassessed: 1, meanCount: null } });
  });
  it('calculates nearest-rank latency percentiles and retains failures in the overall distribution', () => {
    const good = scoreBenchmark(profileCase, compile(profile()));
    const bad = scoreBenchmark(profileCase, {}, 'GENERATION_TIMEOUT');
    const results = [{ run: 1, ...good, durationMs: 10 }, { run: 2, ...good, durationMs: 30 }, { run: 3, ...bad, durationMs: 1000 }];
    expect(summarizeBenchmark(results)).toMatchObject({ schemaValidityRate: 2 / 3,
      latencyMs: { median: 30, p95: 1000, successfulMedian: 10, unsuccessfulMedian: 1000 } });
  });
});
