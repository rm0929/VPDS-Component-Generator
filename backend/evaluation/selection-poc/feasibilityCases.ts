import type { BenchmarkCase } from '../challengeCases';

// Evaluation expectations only; none of this module is imported by generation/composition.
export const feasibilityCases: readonly BenchmarkCase[] = [
  { id: 'email-label', expected: 'supported', prompt: 'Create an email input with a label.',
    expectation: { scope: 'general', forbidExtraFields: true, requirements: [{ key: 'email', type: 'emailInput' }] } },
  { id: 'responsive-login', expected: 'supported', prompt: 'Responsive login form with remember me.',
    expectation: { scope: 'form', forbidExtraFields: true, requirements: [
      { key: 'form', type: 'form' }, { key: 'email', type: 'emailInput', fieldRole: 'email' },
      { key: 'password', type: 'passwordInput', fieldRole: 'password' },
      { key: 'remember', type: 'checkbox', properties: { label: 'Remember me' } },
      { key: 'action', type: 'button' },
    ] } },
  { id: 'profile-row', expected: 'supported', prompt: 'Create a profile form with first name and last name side by side, email below, and a Save Profile button.',
    expectation: { scope: 'form', forbidExtraFields: true, requirements: [
      { key: 'form', type: 'form' }, { key: 'first', type: 'textInput', fieldRole: 'first-name' },
      { key: 'last', type: 'textInput', fieldRole: 'last-name' }, { key: 'email', type: 'emailInput', fieldRole: 'email' },
      { key: 'save', type: 'button', buttonLabel: 'Save Profile' }, { key: 'row', type: 'horizontalLayout' },
    ] }, relationships: [
      { key: 'names-same-row', kind: 'children', parent: 'row', children: ['first', 'last'], ordered: true },
      { key: 'row-before-email', kind: 'before', first: 'row', second: 'email' },
      { key: 'email-before-save', kind: 'before', first: 'email', second: 'save' },
    ] },
];
