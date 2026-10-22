import { describe, expect, it } from 'vitest';
import { evaluationCases, scoreGeneration, summarizeEvaluation } from '../coverage/evaluateGeneration';
import { compileModelUi } from '../../../apps/api/src/ai/compileModelUi';
import { evaluateCoverage } from '../coverage/requirementCoverage';
import registration from '../../../apps/api/src/ai/compatibility/fixtures/registration-draft.json';
import login from '../../../apps/api/test/fixtures/login-draft.json';

const registrationCase = evaluationCases.find(item => item.id === 'registration')!;
const simpleLogin = evaluationCases.find(item => item.id === 'simple-login')!;
const unsupportedCase = evaluationCases.find(item => item.id === 'unsupported-widget')!;

describe('fixed evaluation dataset and separate validity/coverage metrics', () => {
  it('retains all seven original cases and adds independent properties/refusal expectations', () => {
    expect(evaluationCases.map(item => item.id)).toEqual(['registration', 'login', 'contact', 'split-name', 'password-reset',
      'simple-login', 'horizontal-content', 'layout-properties', 'field-properties', 'unsupported-widget', 'unsupported-behavior']);
  });

  it('reports a structurally valid summary as schema-valid but semantically incomplete', () => {
    const summary = compileModelUi({ irVersion: '1', status: 'supported', root: { type: 'text', props: { content: 'Registration Form' } } });
    const result = scoreGeneration(registrationCase, summary);
    expect(result).toMatchObject({ schemaValid: true, requirementCoverage: 0, completeCoverage: false, passed: false });
    expect(summarizeEvaluation([result])).toMatchObject({ schemaValidityRate: 1, completeCoverageRate: 0, requirementCoverageRate: 0 });
  });

  it('does not inflate rates by removing invalid or falsely refused supported requests', () => {
    const results = [scoreGeneration(registrationCase, compileModelUi(registration)),
      scoreGeneration(simpleLogin, undefined, 'INVALID_PROVIDER_OUTPUT'), scoreGeneration(simpleLogin, undefined, 'UNSUPPORTED_UI_REQUEST')];
    expect(summarizeEvaluation(results)).toMatchObject({ supportedCases: 3, schemaValidityRate: 1 / 3,
      completeCoverageRate: 1 / 3, requirementCoverageRate: 7 / 15, falseUnsupportedCount: 1 });
  });

  it('scores expected unsupported requests separately and never accepts generic failures as refusal', () => {
    const refused = scoreGeneration(unsupportedCase, undefined, 'UNSUPPORTED_UI_REQUEST');
    const failed = scoreGeneration(unsupportedCase, undefined, 'OLLAMA_UNAVAILABLE');
    const hallucinated = scoreGeneration(unsupportedCase, compileModelUi(login));
    expect(refused.passed).toBe(true);
    expect(failed.passed).toBe(false);
    expect(hallucinated.passed).toBe(false);
    expect(summarizeEvaluation([refused, failed, hallucinated])).toMatchObject({ schemaValidityRate: null,
      requirementCoverageRate: null, unsupportedAccuracy: 1 / 3 });
  });

  it('checks exact property values and that components occur inside the requested layout', () => {
    const testCase = evaluationCases.find(item => item.id === 'layout-properties')!;
    const input = { irVersion: '1', status: 'supported', root: { type: 'horizontalLayout', props: { gap: 'large' }, children: [
      { type: 'heading', props: { content: 'Welcome', level: 2 } },
      { type: 'button', props: { label: 'Continue', type: 'button', disabled: true } },
    ] } };
    expect(scoreGeneration(testCase, compileModelUi(input)).passed).toBe(true);
    input.root.props.gap = 'small';
    expect(scoreGeneration(testCase, compileModelUi(input))).toMatchObject({ schemaValid: true, requirementCoverage: 2 / 3, passed: false });
    const separated = { irVersion: '1', status: 'supported', root: { type: 'verticalLayout', props: {}, children: [
      { type: 'horizontalLayout', props: { gap: 'large' }, children: [{ type: 'text', props: { content: 'Other' } }] },
      ...input.root.children,
    ] } };
    expect(scoreGeneration(testCase, compileModelUi(separated)).matched).toBe(1);
  });

  it('treats omitted optional booleans as false for semantic evaluation, without changing the document', () => {
    const output = compileModelUi(login);
    const parsed = structuredClone(output);
    expect(evaluateCoverage(output, { scope: 'form', requirements: [
      { key: 'password-enabled', type: 'passwordInput', properties: { disabled: false } },
    ] }).passed).toBe(true);
    expect(output).toEqual(parsed);
  });

  it('evaluates explicit field properties and preserves expectations when a result omits one', () => {
    const testCase = evaluationCases.find(item => item.id === 'field-properties')!;
    const input = { irVersion: '1', status: 'supported', root: { type: 'form', props: { label: 'Contact' }, children: [
      { type: 'emailInput', props: { label: 'Email', required: true, placeholder: 'you@example.com' } },
      { type: 'textInput', props: { label: 'Name', maxLength: 80 } },
      { type: 'button', props: { label: 'Send', type: 'submit' } },
    ] } };
    expect(scoreGeneration(testCase, compileModelUi(input)).passed).toBe(true);
    input.root.children[0].props.required = false;
    expect(scoreGeneration(testCase, compileModelUi(input))).toMatchObject({ schemaValid: true, matched: 3, total: 4, passed: false });
  });
});
