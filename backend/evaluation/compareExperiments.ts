import { readFileSync } from 'node:fs';
import { summarizeBenchmark } from './benchmark';
import type { BenchmarkResult } from './benchmark';
import { summarizeSemanticExperiment } from './semanticExperimentMetrics';

type RunMetadata = {
  variant: string;
  datasetHash: string;
  schemaHash: string;
  compilerRevision: string;
  evaluationRevision: string;
  modelDigest: string;
  ollamaVersion: string;
  settings: Record<string, unknown>;
  evaluatedCaseIds: string[];
  workflow?: 'draft' | 'semantic-plan';
  semanticCompilerRevision?: string;
};
export type ExperimentRun = { metadata: RunMetadata; results: BenchmarkResult[] };

const coreCases = ['registration', 'contact', 'simple-login', 'c-profile', 'c-negation-login', 'c-ui-only-login'];

/** Compare measured quality, not a single combined score that hides regressions. */
export function compareExperiments(baseline: ExperimentRun, candidate: ExperimentRun) {
  const keys = ['datasetHash', 'schemaHash', 'compilerRevision', 'semanticCompilerRevision', 'workflow', 'evaluationRevision', 'modelDigest', 'ollamaVersion', 'settings', 'evaluatedCaseIds'] as const;
  if (keys.some(key => JSON.stringify(baseline.metadata[key]) !== JSON.stringify(candidate.metadata[key]))) {
    throw new Error('Experiments have different frozen inputs or inference settings');
  }
  const attemptKeys = (run: ExperimentRun) => run.results.map(item => `${item.run}:${item.caseId}`).sort();
  const attempts = attemptKeys(baseline);
  if (new Set(attempts).size !== attempts.length || JSON.stringify(attempts) !== JSON.stringify(attemptKeys(candidate))) {
    throw new Error('Experiments have missing or duplicate attempts');
  }
  const before = summarizeBenchmark(baseline.results);
  const after = summarizeBenchmark(candidate.results);
  const reasons: string[] = [];
  for (const key of ['schemaValidityRate', 'completeCoverageRate', 'requirementCoverageRate', 'unsupportedAccuracy'] as const) {
    if (before[key] !== null && (after[key] === null || after[key] < before[key])) reasons.push(`${key} decreased`);
  }
  if (after.forbiddenViolatingCases > before.forbiddenViolatingCases) reasons.push('Forbidden-component violations increased');
  for (const id of coreCases) {
    const count = (run: ExperimentRun) => run.results.filter(item => item.caseId === id && item.passed).length;
    if (count(candidate) < count(baseline)) reasons.push(`Core case regressed: ${id}`);
  }
  for (const key of ['meanCount', 'meanDepth', 'meanSingleChild'] as const) {
    const oldValue = before.layout[key], newValue = after.layout[key];
    if (oldValue !== null && (newValue === null || newValue > oldValue)) reasons.push(`Layout ${key} worsened`);
  }
  const regressions = [...new Set(baseline.results.filter(item => item.passed
    && !candidate.results.find(next => next.run === item.run && next.caseId === item.caseId)?.passed).map(item => item.caseId))];
  const improvements = [...new Set(candidate.results.filter(item => item.passed
    && !baseline.results.find(previous => previous.run === item.run && previous.caseId === item.caseId)?.passed).map(item => item.caseId))];
  const perCase = baseline.metadata.evaluatedCaseIds.map(caseId => {
    const previous = summarizeBenchmark(baseline.results.filter(item => item.caseId === caseId));
    const next = summarizeBenchmark(candidate.results.filter(item => item.caseId === caseId));
    const decreasedQualityMetrics = (['schemaValidityRate', 'completeCoverageRate', 'requirementCoverageRate', 'unsupportedAccuracy'] as const)
      .filter(key => previous[key] !== null && (next[key] === null || next[key] < previous[key]));
    const increasedLayoutMetrics = (['meanCount', 'meanDepth', 'meanSingleChild', 'meanRepeatedDirectionEdges'] as const)
      .filter(key => previous.layout[key] !== null && next.layout[key] !== null && next.layout[key] > previous.layout[key]);
    return { caseId, before: previous, after: next, decreasedQualityMetrics, increasedLayoutMetrics,
      ...(baseline.metadata.workflow === 'semantic-plan' ? { semanticMetrics: {
        before: summarizeSemanticExperiment(baseline.results.filter(item => item.caseId === caseId)),
        after: summarizeSemanticExperiment(candidate.results.filter(item => item.caseId === caseId)),
      } } : {}),
    };
  });
  return { variant: candidate.metadata.variant, retain: reasons.length === 0, reasons, regressions, improvements, before, after, perCase,
    ...(baseline.metadata.workflow === 'semantic-plan' ? { semanticMetrics: {
      before: summarizeSemanticExperiment(baseline.results), after: summarizeSemanticExperiment(candidate.results),
    } } : {}),
  };
}

/** These files are developer-owned outputs of runOllama, never model responses. */
export function readRun(file: string): ExperimentRun {
  const records = readFileSync(file, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  const metadata = records.filter(item => item.event === 'metadata');
  const summary = records.filter(item => item.event === 'summary');
  if (metadata.length !== 1 || summary.length !== 1) throw new Error('Incomplete experiment artifact');
  const results = records.filter(item => item.event === 'result') as BenchmarkResult[];
  const expectedCount = metadata[0].evaluatedCaseIds.length * metadata[0].settings.repeats;
  if (results.length !== expectedCount) throw new Error('Incomplete experiment attempts');
  return { metadata: metadata[0], results };
}

if (require.main === module) {
  try {
    const [baselineFile, ...candidateFiles] = process.argv.slice(2);
    if (!baselineFile || !candidateFiles.length) throw new Error('Paths required');
    const baseline = readRun(baselineFile);
    for (const file of candidateFiles) console.log(JSON.stringify(compareExperiments(baseline, readRun(file))));
  } catch {
    console.error('Comparison failed. Supply complete matching baseline and experiment JSONL files.');
    process.exitCode = 2;
  }
}
