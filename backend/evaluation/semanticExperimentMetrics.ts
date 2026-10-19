import type { BenchmarkResult } from './benchmark';
import { evaluationCases } from './evaluateGeneration';
import { challengeCases } from './challengeCases';
import type { BenchmarkCase } from './challengeCases';

const cases = new Map<string, BenchmarkCase>([...evaluationCases, ...challengeCases].map(item => [item.id, item]));
const rate = (count: number, total: number) => total ? count / total : null;

/** Additional reporting only: never changes frozen expectations or pass/fail scoring. */
export function summarizeSemanticExperiment(results: BenchmarkResult[]) {
  const supported = results.filter(item => item.expected === 'supported');
  const unsupported = results.filter(item => item.expected === 'unsupported');
  const falseUnsupported = supported.filter(item => item.unsupported).length;
  const correctUnsupported = unsupported.filter(item => item.unsupported).length;
  const falseAcceptance = unsupported.filter(item => item.schemaValid).length;
  let expectedChecks = 0, assessedChecks = 0, passedChecks = 0, relationshipAttempts = 0, accurateAttempts = 0;
  for (const result of supported) {
    const testCase = cases.get(result.caseId);
    if (!testCase) throw new Error('Unknown frozen evaluation case');
    const count = testCase.relationships?.length ?? 0;
    expectedChecks += count;
    if (!count) continue;
    relationshipAttempts++;
    if (result.composition) {
      assessedChecks += count;
      passedChecks += count - result.composition.failedRelationships.length;
      if (!result.composition.failedRelationships.length) accurateAttempts++;
    }
  }
  return {
    classification: { supportedAttempts: supported.length, falseUnsupportedCount: falseUnsupported,
      falseUnsupportedRate: rate(falseUnsupported, supported.length), unsupportedAttempts: unsupported.length,
      correctUnsupportedCount: correctUnsupported, correctUnsupportedRate: rate(correctUnsupported, unsupported.length),
      falseAcceptanceCount: falseAcceptance, otherUnsupportedFailures: unsupported.length - correctUnsupported - falseAcceptance },
    layoutAccuracy: { expectedChecks, assessedChecks, passedChecks, unassessedChecks: expectedChecks - assessedChecks,
      checkPassRate: rate(passedChecks, expectedChecks), relationshipAttempts, accurateAttempts,
      completeRelationshipRate: rate(accurateAttempts, relationshipAttempts) },
  };
}
