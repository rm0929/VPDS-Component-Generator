import { summarizeEvaluation } from './evaluateGeneration';
import { scoreBenchmark } from './compositionMetrics';

export type BenchmarkResult = ReturnType<typeof scoreBenchmark> & { run: number; durationMs: number };
const mean = (values: number[]) => values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : null;
function percentile(values: number[], fraction: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.ceil(sorted.length * fraction) - 1] : null;
}

export function summarizeBenchmark(results: BenchmarkResult[]) {
  const supported = results.filter(item => item.expected === 'supported');
  const compositions = supported.flatMap(item => item.composition ? [item.composition] : []);
  return { ...summarizeEvaluation(results),
    forbiddenViolatingCases: compositions.filter(item => item.forbiddenViolations.length).length,
    relationshipFailures: compositions.reduce((sum, item) => sum + item.failedRelationships.length, 0),
    layout: { assessed: compositions.length, unassessed: supported.length - compositions.length,
      overBudgetCases: compositions.filter(item => !item.layoutWithinBudget).length,
      meanCount: mean(compositions.map(item => item.layout.count)),
      meanDepth: mean(compositions.map(item => item.layout.depth)),
      meanSingleChild: mean(compositions.map(item => item.layout.singleChild)),
      meanRepeatedDirectionEdges: mean(compositions.map(item => item.layout.repeatedDirectionEdges)),
    },
    latencyMs: { median: percentile(results.map(item => item.durationMs), .5), p95: percentile(results.map(item => item.durationMs), .95),
      successfulMedian: percentile(results.filter(item => item.schemaValid).map(item => item.durationMs), .5),
      unsuccessfulMedian: percentile(results.filter(item => !item.schemaValid).map(item => item.durationMs), .5) },
  };
}
