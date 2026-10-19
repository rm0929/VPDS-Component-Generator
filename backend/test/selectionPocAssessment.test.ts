import { describe, expect, it } from 'vitest';
import { assessSelection, feasibilityExpectations } from '../evaluation/selection-poc/assessSelection';
import { selectionSchema } from '../evaluation/selection-poc/selection';
import { passesFeasibilityGate } from '../evaluation/selection-poc/runFeasibility';
import { feasibilityCases } from '../evaluation/selection-poc/feasibilityCases';

const profile = () => selectionSchema.parse({ version: 'selection-poc-2', form: { enabled: true, label: null }, unsupported: [], components: [
  { type: 'textInput', props: { label: 'First name' } }, { type: 'textInput', props: { label: 'Last name' }, besidePrevious: true },
  { type: 'emailInput', props: { label: 'Email' } }, { type: 'button', props: { label: 'Save Profile', type: 'submit' } },
] });
describe('independent safe component/layout/form evaluation', () => {
  it('accepts correct selection, row, order and explicit form while emitting no label values', () => {
    const result = assessSelection(profile(), feasibilityExpectations[2], true);
    expect(result).toMatchObject({ componentsCorrect: true, rowsCorrect: true, orderCorrect: true, formCorrect: true, layoutCorrect: true, rows: [[0, 1]] });
    expect(JSON.stringify(result)).not.toContain('Save Profile');
  });
  it('reproduces correct controls with a missing row as a layout failure, not a selection failure', () => {
    const input = profile(); delete input.components[1].besidePrevious;
    expect(assessSelection(input, feasibilityExpectations[2], true)).toMatchObject({ componentsCorrect: true, rowsCorrect: false, layoutCorrect: false });
  });
  it('keeps form absence separate from correct components and a correct row', () => {
    expect(assessSelection(profile(), feasibilityExpectations[2], false)).toMatchObject({ componentsCorrect: true, rowsCorrect: true, formCorrect: false, layoutCorrect: false });
  });
  it('reports wrong labels as property failures without exposing them', () => {
    const input = profile(); input.components[0].props = { label: 'PRIVATE-WRONG' };
    const result = assessSelection(input, feasibilityExpectations[2], true);
    expect(result.componentsCorrect).toBe(false);
    expect(result.matches[0].properties.label).toBe(false);
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
  });
  it('detects reversed order independently of the component multiset', () => {
    const input = profile(); input.components.reverse();
    expect(assessSelection(input, feasibilityExpectations[2], true)).toMatchObject({ componentsCorrect: true, orderCorrect: false });
  });
  it('flags extra components and treats an explicit unsupported outcome as unsuccessful selection', () => {
    const input = profile(); input.components.push({ type: 'text', props: { content: 'Extra' } });
    expect(assessSelection(input, feasibilityExpectations[2], true)).toMatchObject({ componentsCorrect: false, extraIndexes: [4] });
    const refused = profile(); refused.unsupported = ['composition'];
    expect(assessSelection(refused, feasibilityExpectations[2], true).componentsCorrect).toBe(false);
  });
  it('honors frozen case-insensitive label comparison and native false defaults', () => {
    const input = profile();
    expect(assessSelection(input, { ...feasibilityExpectations[2], components: [
      { type: 'textInput', props: { label: ' first NAME ', required: false, disabled: false } }, ...feasibilityExpectations[2].components.slice(1),
    ] }, true).componentsCorrect).toBe(true);
  });
  it('requires exact row membership and distinct repeated controls', () => {
    const input = profile(); input.components[2].besidePrevious = true;
    expect(assessSelection(input, feasibilityExpectations[2], true).rowsCorrect).toBe(false);
    input.components.splice(1, 1);
    expect(assessSelection(input, feasibilityExpectations[2], true).componentsCorrect).toBe(false);
  });
});

describe('conditional full-benchmark gate', () => {
  type Attempt = Parameters<typeof passesFeasibilityGate>[0][number];
  const successful = (): Attempt[] => feasibilityCases.map((testCase, index) => ({ event: 'result', caseId: testCase.id,
    phase: 'feasibility', run: 1, expected: 'supported', selectionValid: true, specificationValid: true, formMembershipCorrect: true,
    tsxValid: true, passed: true, durationMs: 1,
    form: { enabled: index > 0, labelProvided: false, defaultNameUsed: index > 0, nameCorrect: true },
    assessment: { ...assessSelection(profile(), feasibilityExpectations[2], true) },
  }));
  it('opens only for three complete successes', () => {
    expect(passesFeasibilityGate(successful())).toBe(true);
    expect(passesFeasibilityGate([])).toBe(false);
    expect(passesFeasibilityGate(successful().slice(0, 2))).toBe(false);
    const duplicates = successful(); duplicates[1].caseId = duplicates[0].caseId;
    expect(passesFeasibilityGate(duplicates)).toBe(false);
  });
  it.each(['componentsCorrect', 'rowsCorrect', 'orderCorrect', 'formCorrect', 'layoutCorrect'] as const)(
    'blocks the benchmark on %s even when compilation passes', key => {
      const results = successful(); results[2].assessment![key] = false;
      // Recompute overall result as the runner does for real inference.
      results[2].passed = results[2].assessment!.componentsCorrect && results[2].assessment!.rowsCorrect
        && results[2].assessment!.orderCorrect && results[2].assessment!.formCorrect && results[2].assessment!.layoutCorrect;
      expect(passesFeasibilityGate(results)).toBe(false);
    },
  );
  it('blocks specification, naming or TSX failures', () => {
    for (const key of ['specificationValid', 'formMembershipCorrect', 'tsxValid'] as const) {
      const results = successful(); results[0][key] = false;
      expect(passesFeasibilityGate(results)).toBe(false);
    }
    const results = successful(); results[1].form!.nameCorrect = false;
    expect(passesFeasibilityGate(results)).toBe(false);
  });
});
