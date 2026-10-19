import type { CoverageExpectation } from '../src/requirementCoverage';

/** Human-authored expectations, independent of the prompt recognizer and model. */
export const coverageCases: readonly { id: string; prompt: string; expectation: CoverageExpectation }[] = [
  {
    id: 'registration',
    prompt: 'Create a registration form with name, email, password, confirm password, a terms checkbox, and a submit button.',
    expectation: { scope: 'form', forbidExtraFields: true, requirements: [
      { key: 'form', type: 'form' },
      { key: 'name', type: 'textInput', fieldRole: 'name' },
      { key: 'email', type: 'emailInput', fieldRole: 'email' },
      { key: 'password', type: 'passwordInput', fieldRole: 'password' },
      { key: 'confirm-password', type: 'passwordInput', fieldRole: 'confirm-password' },
      { key: 'terms', type: 'checkbox', fieldRole: 'terms' },
      { key: 'submit', type: 'button', buttonType: 'submit' },
    ] },
  },
  {
    id: 'login', prompt: 'Create a login form with email, password, and a submit button.',
    expectation: { scope: 'form', forbidExtraFields: true, requirements: [
      { key: 'form', type: 'form' }, { key: 'email', type: 'emailInput', fieldRole: 'email' },
      { key: 'password', type: 'passwordInput', fieldRole: 'password' },
      { key: 'submit', type: 'button', buttonType: 'submit' },
    ] },
  },
  {
    id: 'contact', prompt: 'Create a contact form with name, email, a short message, and a submit button.',
    expectation: { scope: 'form', forbidExtraFields: true, requirements: [
      { key: 'form', type: 'form' }, { key: 'name', type: 'textInput', fieldRole: 'name' },
      { key: 'email', type: 'emailInput', fieldRole: 'email' }, { key: 'message', type: 'textInput', fieldRole: 'message' },
      { key: 'submit', type: 'button', buttonType: 'submit' },
    ] },
  },
  {
    id: 'split-name', prompt: 'Create a signup form with first name, last name, email, and a submit button.',
    expectation: { scope: 'form', forbidExtraFields: true, requirements: [
      { key: 'form', type: 'form' }, { key: 'first-name', type: 'textInput', fieldRole: 'first-name' },
      { key: 'last-name', type: 'textInput', fieldRole: 'last-name' }, { key: 'email', type: 'emailInput', fieldRole: 'email' },
      { key: 'submit', type: 'button', buttonType: 'submit' },
    ] },
  },
  {
    id: 'password-reset', prompt: 'Create a password reset form with email and a submit button.',
    expectation: { scope: 'form', forbidExtraFields: true, requirements: [
      { key: 'form', type: 'form' }, { key: 'email', type: 'emailInput', fieldRole: 'email' },
      { key: 'submit', type: 'button', buttonType: 'submit' },
    ] },
  },
  {
    id: 'simple-login', prompt: 'Create a simple login form with email, password, and a Login button.',
    expectation: { scope: 'form', forbidExtraFields: true, requirements: [
      { key: 'form', type: 'form' }, { key: 'email', type: 'emailInput', fieldRole: 'email' },
      { key: 'password', type: 'passwordInput', fieldRole: 'password' },
      { key: 'login', type: 'button', buttonType: 'submit', buttonLabel: 'Login' },
    ] },
  },
  {
    id: 'horizontal-content', prompt: 'Show a heading and description in a horizontal layout.',
    expectation: { scope: 'general', forbidExtraFields: true, requirements: [
      { key: 'row', type: 'horizontalLayout' }, { key: 'heading', type: 'heading' }, { key: 'description', type: 'text' },
    ] },
  },
];
