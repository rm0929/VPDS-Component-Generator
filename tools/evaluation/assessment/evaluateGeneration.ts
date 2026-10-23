import { coverageCases } from './coverageCases';
import { evaluateCoverage } from './requirementCoverage';
import type { CoverageExpectation } from './requirementCoverage';

export type EvaluationCase = { id: string; prompt: string } & (
  { expected: 'supported'; expectation: CoverageExpectation } | { expected: 'unsupported' }
);

// Preserve existing expectations. New cases test properties/relationships and explicit refusal.
export const evaluationCases: readonly EvaluationCase[] = [
  ...coverageCases.map(item => ({ ...item, expected: 'supported' as const })),
  { id: 'layout-properties', expected: 'supported',
    prompt: 'Create a horizontal layout with large gap, a level 2 heading labeled Welcome, and a disabled ordinary Continue button.',
    expectation: { scope: 'general', requirements: [
      { key: 'row', type: 'horizontalLayout', properties: { gap: 'large' } },
      { key: 'heading', type: 'heading', within: 'horizontalLayout', properties: { content: 'Welcome', level: 2 } },
      { key: 'action', type: 'button', within: 'horizontalLayout', properties: { label: 'Continue', type: 'button', disabled: true } },
    ] },
  },
  { id: 'field-properties', expected: 'supported',
    prompt: 'Create a form with a required Email input with placeholder you@example.com, an optional Name input limited to 80 characters, and an enabled Send submit button.',
    expectation: { scope: 'form', forbidExtraFields: true, requirements: [
      { key: 'form', type: 'form' },
      { key: 'email', type: 'emailInput', fieldRole: 'email', properties: { required: true, placeholder: 'you@example.com' } },
      { key: 'name', type: 'textInput', fieldRole: 'name', required: false, properties: { maxLength: 80 } },
      { key: 'submit', type: 'button', buttonType: 'submit', buttonLabel: 'Send', properties: { disabled: false } },
    ] },
  },
  { id: 'unsupported-widget', expected: 'unsupported', prompt: 'Create a form with email, a country select dropdown, and a submit button.' },
  { id: 'unsupported-behavior', expected: 'unsupported', prompt: 'Create a login form that authenticates users against a server and saves their passwords.' },
];

export function scoreGeneration(testCase: EvaluationCase, output: unknown, errorCode?: string) {
  const report = evaluateCoverage(output, testCase.expected === 'supported' ? testCase.expectation : { scope: 'general', requirements: [] });
  const unsupported = errorCode === 'UNSUPPORTED_UI_REQUEST';
  return { caseId: testCase.id, expected: testCase.expected, schemaValid: report.schemaValid,
    requirementCoverage: testCase.expected === 'supported' ? report.coverage : null,
    completeCoverage: testCase.expected === 'supported' && report.passed,
    matched: report.matched.length, total: testCase.expected === 'supported' ? testCase.expectation.requirements.length : 0,
    unexpectedFields: report.unexpectedFieldIds.length, unsupported,
    passed: testCase.expected === 'unsupported' ? unsupported : report.passed,
  };
}

export function summarizeEvaluation(results: ReturnType<typeof scoreGeneration>[]) {
  const supported = results.filter(item => item.expected === 'supported');
  const unsupported = results.filter(item => item.expected === 'unsupported');
  const total = supported.reduce((sum, item) => sum + item.total, 0);
  const rate = (count: number, denominator: number) => denominator ? count / denominator : null;
  return { cases: results.length, supportedCases: supported.length,
    schemaValidityRate: rate(supported.filter(item => item.schemaValid).length, supported.length),
    completeCoverageRate: rate(supported.filter(item => item.completeCoverage).length, supported.length),
    requirementCoverageRate: rate(supported.reduce((sum, item) => sum + item.matched, 0), total),
    unsupportedAccuracy: rate(unsupported.filter(item => item.unsupported).length, unsupported.length),
    falseUnsupportedCount: supported.filter(item => item.unsupported).length,
  };
}
