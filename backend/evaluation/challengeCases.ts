import type { EvaluationCase } from './evaluateGeneration';
import type { CoverageRequirement } from '../src/requirementCoverage';

export const CHALLENGE_VERSION = 'challenge-v1';
export type Relationship =
  | { key: string; kind: 'children'; parent: string; children: string[]; ordered: boolean }
  | { key: string; kind: 'before'; first: string; second: string };
export type BenchmarkCase = EvaluationCase & {
  forbidden?: CoverageRequirement[];
  relationships?: Relationship[];
  layoutBudget?: { count: number; depth: number };
};

const req = (key: string, type: CoverageRequirement['type'], properties?: CoverageRequirement['properties']): CoverageRequirement =>
  ({ key, type, ...(properties ? { properties } : {}) });
const form = req('form', 'form');
const email = req('email', 'emailInput', { label: 'Email' });
const password = req('password', 'passwordInput', { label: 'Password' });
const login = req('login', 'button', { label: 'Login', type: 'submit' });
const loginRequirements = [form, email, password, login];

/** Human-authored, frozen before any prompting experiment. No keyword extraction. */
export const challengeCases: readonly BenchmarkCase[] = [
  { id: 'c-text-input', prompt: 'Create a standalone optional, enabled text input labeled Display name, limited to 32 characters.', expected: 'supported',
    expectation: { scope: 'general', requirements: [req('input', 'textInput', { label: 'Display name', required: false, disabled: false, maxLength: 32 })] }, layoutBudget: { count: 0, depth: 0 } },
  { id: 'c-email-input', prompt: 'Create a standalone required email input labeled Email with placeholder you@example.com.', expected: 'supported',
    expectation: { scope: 'general', requirements: [req('email', 'emailInput', { label: 'Email', required: true, placeholder: 'you@example.com' })] }, layoutBudget: { count: 0, depth: 0 } },
  { id: 'c-password-input', prompt: 'Create a standalone disabled password input labeled Secret with maximum length 72.', expected: 'supported',
    expectation: { scope: 'general', requirements: [req('password', 'passwordInput', { label: 'Secret', disabled: true, maxLength: 72 })] }, layoutBudget: { count: 0, depth: 0 } },
  { id: 'c-checkbox', prompt: 'Create an optional, enabled checkbox labeled Notify me.', expected: 'supported',
    expectation: { scope: 'general', requirements: [req('checkbox', 'checkbox', { label: 'Notify me', required: false, disabled: false })] }, layoutBudget: { count: 0, depth: 0 } },
  { id: 'c-button', prompt: 'Create a disabled ordinary button labeled Continue. Its type should be button.', expected: 'supported',
    expectation: { scope: 'general', requirements: [req('button', 'button', { label: 'Continue', type: 'button', disabled: true })] }, layoutBudget: { count: 0, depth: 0 } },
  { id: 'c-text', prompt: 'Display only a paragraph containing Account details.', expected: 'supported',
    expectation: { scope: 'general', requirements: [req('text', 'text', { content: 'Account details' })] }, forbidden: [req('heading', 'heading')], layoutBudget: { count: 0, depth: 0 } },
  { id: 'c-heading', prompt: 'Display a level 3 heading containing Preferences.', expected: 'supported',
    expectation: { scope: 'general', requirements: [req('heading', 'heading', { content: 'Preferences', level: 3 })] }, layoutBudget: { count: 0, depth: 0 } },
  { id: 'c-row', prompt: 'Create one horizontal layout with small gap. Its direct children, in order, are a paragraph containing Left and an ordinary button labeled Next.', expected: 'supported',
    expectation: { scope: 'general', requirements: [req('row', 'horizontalLayout', { gap: 'small' }), req('text', 'text', { content: 'Left' }), req('button', 'button', { label: 'Next', type: 'button' })] },
    relationships: [{ key: 'row-children', kind: 'children', parent: 'row', children: ['text', 'button'], ordered: true }], layoutBudget: { count: 1, depth: 1 } },
  { id: 'c-column', prompt: 'Create one vertical layout with large gap. Its direct children, in order, are a paragraph containing Above and a paragraph containing Below.', expected: 'supported',
    expectation: { scope: 'general', requirements: [req('column', 'verticalLayout', { gap: 'large' }), req('above', 'text', { content: 'Above' }), req('below', 'text', { content: 'Below' })] },
    relationships: [{ key: 'column-children', kind: 'children', parent: 'column', children: ['above', 'below'], ordered: true }], layoutBudget: { count: 1, depth: 1 } },
  { id: 'c-form-actions', prompt: 'Create a form with a required Email input, a Reset button of type reset, and a Send button of type submit, in that order.', expected: 'supported',
    expectation: { scope: 'form', forbidExtraFields: true, requirements: [form, req('email', 'emailInput', { label: 'Email', required: true }), req('reset', 'button', { label: 'Reset', type: 'reset' }), req('send', 'button', { label: 'Send', type: 'submit' })] },
    relationships: [{ key: 'email-before-reset', kind: 'before', first: 'email', second: 'reset' }, { key: 'reset-before-send', kind: 'before', first: 'reset', second: 'send' }], layoutBudget: { count: 1, depth: 1 } },
  { id: 'c-profile', prompt: 'Create a profile form with first name and last name side by side, email below them, and a Save Profile button.', expected: 'supported',
    expectation: { scope: 'form', forbidExtraFields: true, requirements: [form, req('first', 'textInput', { label: 'First name' }), req('last', 'textInput', { label: 'Last name' }), email, req('save', 'button', { label: 'Save Profile' }), req('row', 'horizontalLayout')] },
    relationships: [{ key: 'names-same-row', kind: 'children', parent: 'row', children: ['first', 'last'], ordered: true }, { key: 'row-before-email', kind: 'before', first: 'row', second: 'email' }, { key: 'email-before-save', kind: 'before', first: 'email', second: 'save' }], layoutBudget: { count: 2, depth: 2 } },
  { id: 'c-newsletter', prompt: 'Create a newsletter form with a required Email input, an optional checkbox labeled Weekly updates, and a Subscribe submit button. Do not add name or password fields.', expected: 'supported',
    expectation: { scope: 'form', forbidExtraFields: true, requirements: [form, req('email', 'emailInput', { label: 'Email', required: true }), req('updates', 'checkbox', { label: 'Weekly updates', required: false }), req('subscribe', 'button', { label: 'Subscribe', type: 'submit' })] },
    forbidden: [req('no-text-input', 'textInput'), req('no-password', 'passwordInput')], layoutBudget: { count: 1, depth: 1 } },
  { id: 'c-negation-login', prompt: 'Create a login form with email, password, and a Login submit button. Do not add a checkbox, heading, or other inputs.', expected: 'supported',
    expectation: { scope: 'form', forbidExtraFields: true, requirements: loginRequirements }, forbidden: [req('no-checkbox', 'checkbox'), req('no-heading', 'heading'), req('no-text-input', 'textInput')], layoutBudget: { count: 1, depth: 1 } },
  { id: 'c-ui-only-login', prompt: 'Create a login form with Email and Password inputs and a Login submit button. This is UI only: do not authenticate users or make network requests.', expected: 'supported',
    expectation: { scope: 'form', forbidExtraFields: true, requirements: loginRequirements }, forbidden: [req('no-checkbox', 'checkbox')], layoutBudget: { count: 1, depth: 1 } },
  { id: 'c-mixed', prompt: 'Create a form with a vertical layout. Its direct children are a horizontal layout containing City then Postal code text inputs, followed by an enabled Save submit button. Use medium gaps.', expected: 'supported',
    expectation: { scope: 'form', forbidExtraFields: true, requirements: [form, req('column', 'verticalLayout', { gap: 'medium' }), req('row', 'horizontalLayout', { gap: 'medium' }), req('city', 'textInput', { label: 'City' }), req('postal', 'textInput', { label: 'Postal code' }), req('save', 'button', { label: 'Save', type: 'submit', disabled: false })] },
    relationships: [{ key: 'form-column', kind: 'children', parent: 'form', children: ['column'], ordered: true }, { key: 'column-order', kind: 'children', parent: 'column', children: ['row', 'save'], ordered: true }, { key: 'row-order', kind: 'children', parent: 'row', children: ['city', 'postal'], ordered: true }], layoutBudget: { count: 2, depth: 2 } },
  { id: 'c-repeated-fields', prompt: 'Create a form with two separate optional text inputs both labeled Code and a Verify submit button.', expected: 'supported',
    expectation: { scope: 'form', forbidExtraFields: true, requirements: [form, req('code-one', 'textInput', { label: 'Code', required: false }), req('code-two', 'textInput', { label: 'Code', required: false }), req('verify', 'button', { label: 'Verify', type: 'submit' })] }, layoutBudget: { count: 1, depth: 1 } },
  { id: 'c-unsupported-image', prompt: 'Create a profile form with an email input, a user avatar image, and a save button.', expected: 'unsupported' },
  { id: 'c-unsupported-storage', prompt: 'Create a form that sends payment details to an API and stores the response in a database.', expected: 'unsupported' },
];
