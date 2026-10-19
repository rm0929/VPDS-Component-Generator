import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { readProviderConfig } from '../src/providerConfig';
import { buildModelSchema } from '../src/modelSchema';
import { buildSemanticModelSchema, buildSemanticModelInstructions } from '../src/semanticModelSchema';
import { ApiError } from '../src/errors';
import { createGenerationDiagnostics } from '../src/diagnostics';
import type { DiagnosticEntry } from '../src/diagnostics';
import { evaluationCases } from './evaluateGeneration';
import { challengeCases } from './challengeCases';
import { scoreBenchmark } from './compositionMetrics';
import { summarizeBenchmark } from './benchmark';
import type { BenchmarkResult } from './benchmark';
import { evaluationProvider } from './evaluationProvider';
import { hash, runtimeMetadata, sourceMetadata } from './metadata';
import manifest from './fixtures/frozen-manifest.json';
import { experimentMessages, PROMPT_VARIANTS } from './promptExperiments';
import type { PromptVariant } from './promptExperiments';
import { semanticExperimentMessages, SEMANTIC_PROMPT_VARIANTS, semanticSourceMetadata } from './semanticPromptExperiments';
import type { SemanticPromptVariant } from './semanticPromptExperiments';
import semanticManifest from './fixtures/semantic-manifest-v1.json';
import { summarizeSemanticExperiment } from './semanticExperimentMetrics';

/** Manual only: no inference in application startup, builds, tests, or CI. */
async function main() {
  if (process.env.API_PROVIDER !== 'ollama') throw new Error('Explicit local inference opt-in required');
  const config = readProviderConfig();
  if (config.provider !== 'ollama' || config.model !== 'qwen3:4b-instruct') throw new Error('Keep the approved local model');
  const repeats = Number(process.env.EVALUATION_REPEATS ?? '2');
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 5) throw new Error('Invalid repeat count');
  const allCases = [...evaluationCases, ...challengeCases];
  const semantic = config.workflow === 'semantic-plan';
  const schemaHash = hash(JSON.stringify(semantic ? buildSemanticModelSchema() : buildModelSchema()));
  if (hash(JSON.stringify(allCases)) !== manifest.datasetHash || schemaHash !== (semantic ? semanticManifest.schemaHash : manifest.schemaHash)) {
    throw new Error('Frozen dataset/schema changed');
  }
  const variant = process.env.EVALUATION_VARIANT ?? 'baseline';
  const variants = semantic ? SEMANTIC_PROMPT_VARIANTS : PROMPT_VARIANTS;
  if (!(variants as readonly string[]).includes(variant)) throw new Error('Unknown prompt experiment');
  const messages = semantic ? semanticExperimentMessages(variant as SemanticPromptVariant) : experimentMessages(variant as PromptVariant);
  const root = resolve(__dirname, '../..');
  const sources = sourceMetadata(root);
  if (sources.compilerRevision !== manifest.compilerRevision) throw new Error('Compiler changed after freeze');
  const semanticSources = semantic ? semanticSourceMetadata(root) : undefined;
  if (semantic && (semanticSources?.semanticCompilerRevision !== semanticManifest.semanticCompilerRevision
    || hash(JSON.stringify([{ role: 'system', content: buildSemanticModelInstructions() }])) !== semanticManifest.baselinePromptHash
    || hash(JSON.stringify(semanticExperimentMessages('baseline'))) !== semanticManifest.baselinePromptHash
    || hash(JSON.stringify(semanticExperimentMessages('ui-only-interpretation-v1'))) !== semanticManifest.variantPromptHash)) {
    throw new Error('Semantic baseline changed after freeze');
  }
  const selectedIds = process.env.EVALUATION_CASE_IDS ? process.env.EVALUATION_CASE_IDS.split(',') : undefined;
  if (selectedIds?.some(id => !allCases.some(item => item.id === id))) throw new Error('Unknown case ID');
  const cases = selectedIds ? allCases.filter(item => selectedIds.includes(item.id)) : allCases;
  const runtime = await runtimeMetadata(config);
  const outputFile = process.env.EVALUATION_OUTPUT;
  if (outputFile) { mkdirSync(dirname(resolve(outputFile)), { recursive: true }); writeFileSync(outputFile, '', { flag: 'wx' }); }
  const emit = (record: unknown) => {
    const line = JSON.stringify(record);
    console.log(line);
    if (outputFile) appendFileSync(outputFile, line + '\n');
  };
  const evaluationFiles = ['backend/evaluation/compositionMetrics.ts', 'backend/evaluation/benchmark.ts', 'backend/src/requirementCoverage.ts'];
  if (semantic) evaluationFiles.push('backend/evaluation/semanticExperimentMetrics.ts');
  const evaluationRevision = hash(evaluationFiles.map(file => readFileSync(resolve(root, file), 'utf8')).join('\n'));
  emit({ event: 'metadata', datasetVersion: manifest.datasetVersion, challengeVersion: manifest.challengeVersion,
    datasetHash: manifest.datasetHash, schemaHash, workflow: config.workflow, variant, promptHash: hash(JSON.stringify(messages)),
    evaluationRevision, ...sources, ...semanticSources, ...runtime, evaluatedCaseIds: cases.map(item => item.id),
    settings: { model: config.model, contextSize: config.contextSize, maxOutputTokens: config.maxOutputTokens,
      timeoutMs: config.timeoutMs, responseLimitBytes: config.responseLimitBytes, temperature: 0, seed: 0, think: false,
      stream: false, keepAlive: '2m', repeats }, order: 'fixed; cold first attempt retained', startedAt: new Date().toISOString() });
  let diagnostics: DiagnosticEntry[] = [];
  const diagnose = createGenerationDiagnostics({ NODE_ENV: 'development', API_LOCAL_DIAGNOSTICS: 'true' }, entry => diagnostics.push(entry));
  const provider = evaluationProvider(config, messages, diagnose);
  const results: BenchmarkResult[] = [];
  for (let run = 1; run <= repeats; run++) {
    for (const testCase of cases) {
      diagnostics = [];
      const started = performance.now();
      let output: unknown;
      let errorCode: string | undefined;
      try { output = await provider.generate(testCase.prompt, { signal: new AbortController().signal }); }
      catch (error) { errorCode = error instanceof ApiError ? error.code : 'PROVIDER_FAILURE'; }
      const result = { run, ...scoreBenchmark(testCase, output, errorCode), durationMs: Math.round(performance.now() - started) };
      results.push(result);
      emit({ event: 'result', dataset: testCase.id.startsWith('c-') ? 'challenge' : 'legacy', ...result, errorCode, diagnostics });
    }
  }
  const after = await runtimeMetadata(config);
  if (after.modelDigest !== runtime.modelDigest || after.ollamaVersion !== runtime.ollamaVersion) throw new Error('Runtime/model changed during evaluation');
  emit({ event: 'summary', variant, summary: summarizeBenchmark(results),
    ...(semantic ? { semanticMetrics: summarizeSemanticExperiment(results) } : {}),
    legacy: summarizeBenchmark(results.filter(item => !item.caseId.startsWith('c-'))),
    challenge: summarizeBenchmark(results.filter(item => item.caseId.startsWith('c-'))) });
  if (results.some(item => !item.passed)) process.exitCode = 1;
}

void main().catch(() => {
  console.error('Manual evaluation failed. Check local Ollama metadata, frozen inputs, explicit provider/model, selected case IDs, repeats 1..5, and a fresh output path.');
  process.exitCode = 2;
});
