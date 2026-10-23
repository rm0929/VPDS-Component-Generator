import { tmpdir } from 'node:os';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { readProviderConfig } from '../../../apps/api/src/providerConfig';
import type { OllamaConfig } from '../../../apps/api/src/providerConfig';
import { generateTsx } from '@vpds/ui-specification/generateTsx';
import { hash, runtimeMetadata } from '../assessment/metadata';
import { requestSelectionPoc } from './ollama';
import { buildSelectionModelSchema, selectionMessages } from '../../../apps/api/src/ai/model';
import { feasibilityCases } from './feasibilityCases';
import { describePocFailure } from './diagnostics';
import { checkGeneratedTsx } from '../../../packages/ui-specification/test/support/checkGeneratedTsx';
import { compileSelectionPoc, DEFAULT_FORM_LABEL } from '../../../apps/api/src/ai/selection';
import { assessSelection, feasibilityExpectations } from './assessSelection';
import type { SelectionExpectation } from './assessSelection';
import dataset from './cases-v1.json';

type Case = { id: string; prompt: string; expected: string; unsupported?: string[] };
type Attempt = {
  event: 'result'; caseId: string; phase: 'feasibility' | 'benchmark'; run: number; expected: string;
  selectionValid: boolean; assessment?: ReturnType<typeof assessSelection>;
  form?: { enabled: boolean; labelProvided: boolean; defaultNameUsed: boolean; nameCorrect: boolean };
  specificationValid: boolean; formMembershipCorrect: boolean; tsxValid: boolean | null; passed: boolean;
  failure?: ReturnType<typeof describePocFailure>; tsxDiagnosticCodes?: number[]; inferenceMs?: number; durationMs: number;
};

/** Every required axis must pass; compilation alone cannot unlock the benchmark. */
export function passesFeasibilityGate(results: Attempt[]) {
  return results.length === 3 && new Set(results.map(result => result.caseId)).size === 3
    && results.every(result => feasibilityCases.some(testCase => testCase.id === result.caseId)
      && result.passed && result.selectionValid && result.specificationValid && result.formMembershipCorrect && result.tsxValid
      && result.form?.nameCorrect && result.assessment?.componentsCorrect && result.assessment.layoutCorrect);
}

async function runAttempt(testCase: Case, expected: SelectionExpectation | undefined, phase: Attempt['phase'], run: number,
  config: OllamaConfig, directory: string): Promise<Attempt> {
  const started = performance.now();
  const result: Attempt = { event: 'result', caseId: testCase.id, phase, run, expected: testCase.expected,
    selectionValid: false, specificationValid: false, formMembershipCorrect: false, tsxValid: null, passed: false, durationMs: 0 };
  try {
    const selection = await requestSelectionPoc(testCase.prompt, config, new AbortController().signal);
    result.inferenceMs = Math.round(performance.now() - started);
    result.selectionValid = true;
    if (expected) result.assessment = assessSelection(selection, expected, selection.form.enabled);
    const label = selection.form.label ?? DEFAULT_FORM_LABEL;
    result.form = { enabled: selection.form.enabled, labelProvided: selection.form.label !== null,
      defaultNameUsed: selection.form.enabled && selection.form.label === null,
      nameCorrect: !(phase === 'benchmark' && expected?.formLabel)
        || label.trim().toLowerCase() === expected.formLabel.trim().toLowerCase() };
    // Capture safe component metadata before composition, including on failures.
    const specification = compileSelectionPoc(selection);
    result.specificationValid = true;
    result.formMembershipCorrect = !!result.assessment?.formCorrect;
    const code = generateTsx(specification);
    const errors = checkGeneratedTsx([code]);
    result.tsxValid = errors.length === 0;
    result.tsxDiagnosticCodes = errors.map(error => error.code);
    if (errors.length) result.failure = { stage: 'tsx', issues: errors.slice(0, 20).map(() => ({
      path: [], code: 'custom', message: 'Generated TSX failed the installed type contract.',
    })) };
    const stem = `${phase}-${run}-${testCase.id}`;
    writeFileSync(resolve(directory, `${stem}.spec.json`), JSON.stringify(specification, null, 2) + '\n', { flag: 'wx' });
    writeFileSync(resolve(directory, `${stem}.tsx.txt`), code, { flag: 'wx' });
    result.passed = testCase.expected === 'supported' && !!result.assessment?.componentsCorrect
      && result.assessment.layoutCorrect && result.form.nameCorrect && result.formMembershipCorrect && result.tsxValid;
  } catch (error) {
    result.failure = describePocFailure(error);
    if (testCase.expected !== 'supported' && result.failure.stage === 'unsupported' && 'unsupported' in result.failure) {
      result.passed = JSON.stringify([...(result.failure.unsupported ?? [])].sort()) === JSON.stringify([...(testCase.unsupported ?? [])].sort());
    }
  }
  result.durationMs = Math.round(performance.now() - started);
  return result;
}

/** Manual-only: gated feasibility by default, or an explicitly approved 12 × 3 benchmark. */
async function main() {
  if (process.env.API_PROVIDER !== 'ollama') throw new Error('Explicit local opt-in required');
  const config = readProviderConfig();
  if (config.provider !== 'ollama' || config.model !== 'qwen3:4b-instruct') throw new Error('Keep the approved model');
  const datasetHash = hash(readFileSync(resolve(__dirname, 'cases-v1.json'), 'utf8'));
  if (datasetHash !== 'cd20106e24e0d55fdb6c457551d14a5ce3e301f3256f7d834bc092afe8c8dd7b') throw new Error('Frozen dataset changed');
  const directory = resolve(process.env.POC_OUTPUT_DIRECTORY ?? resolve(tmpdir(), 'vpds-selection-feasibility'));
  mkdirSync(dirname(directory), { recursive: true }); mkdirSync(directory);
  const runtime = await runtimeMetadata(config);
  const inputs = { schema: buildSelectionModelSchema(), messages: selectionMessages() };
  const benchmarkOnly = process.env.POC_BENCHMARK_ONLY === 'true';
  const benchmarkRequested = benchmarkOnly || process.env.POC_BENCHMARK_IF_PASS === 'true';
  writeFileSync(resolve(directory, 'inputs.json'), JSON.stringify(inputs, null, 2) + '\n', { flag: 'wx' });
  const records: unknown[] = [{ event: 'metadata', ...runtime, model: config.model, datasetHash,
    schemaHash: hash(JSON.stringify(inputs.schema)), promptHash: hash(JSON.stringify(inputs.messages)),
    settings: { temperature: 0, seed: 0, contextSize: config.contextSize, maxOutputTokens: config.maxOutputTokens,
      responseLimitBytes: config.responseLimitBytes, timeoutMs: config.timeoutMs, think: false, stream: false },
    mode: benchmarkOnly ? 'approved-benchmark-only' : 'gated-feasibility',
    gate: benchmarkOnly ? 'Explicit benchmark-only opt-in; feasibility gate waived by user approval.'
      : 'All three feasibility cases must pass selection, order, row, form, naming, specification and TSX checks.',
    responsiveness: 'Browser responsiveness and breakpoints are not represented or verified.' }];
  const emit = (record: unknown) => {
    records.push(record); writeFileSync(resolve(directory, 'results.json'), JSON.stringify(records, null, 2) + '\n');
    console.log(JSON.stringify(record));
  };
  const initial: Attempt[] = [];
  if (!benchmarkOnly) {
    for (let index = 0; index < feasibilityCases.length; index++) {
      const result = await runAttempt(feasibilityCases[index], feasibilityExpectations[index], 'feasibility', 1, config, directory);
      initial.push(result); emit(result);
    }
  }
  const gate = benchmarkOnly || passesFeasibilityGate(initial);
  emit({ event: 'gate', passed: gate, benchmarkRequested, feasibilityGateWaived: benchmarkOnly });
  if (gate && benchmarkRequested) {
    for (let run = 1; run <= 3; run++) {
      for (const testCase of dataset.cases) {
        const expected = testCase.expected === 'supported' ? {
          components: testCase.components ?? [], rows: testCase.rows ?? [], formLabel: testCase.formLabel ?? null,
          forbiddenTypes: testCase.forbiddenTypes,
        } : undefined;
        emit(await runAttempt(testCase, expected, 'benchmark', run, config, directory));
      }
    }
  }
  const after = await runtimeMetadata(config);
  if (runtime.modelDigest !== after.modelDigest || runtime.ollamaVersion !== after.ollamaVersion) throw new Error('Runtime changed');
  emit({ event: 'complete', feasibilityCalls: initial.length, benchmarkCalls: gate && benchmarkRequested ? 36 : 0 });
}
if (require.main === module) void main().catch(() => { console.error('PoC run failed. Check explicit local opt-in, frozen inputs and a fresh output directory.'); process.exitCode = 2; });
