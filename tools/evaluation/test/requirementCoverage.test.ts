import { describe, expect, it } from 'vitest';
import registration from '@vpds/ui-specification/fixtures/registration-form.json';
import { uiSpecificationSchema } from '@vpds/ui-specification/uiSpecification';
import type { UiNode, ComponentType } from '@vpds/ui-specification/componentRegistry';
import { coverageCases } from '../assessment/coverageCases';
import { deriveFormExpectation, evaluateCoverage } from '../assessment/requirementCoverage';
import type { CoverageRequirement, CoverageExpectation } from '../assessment/requirementCoverage';

const collapsed = { version: '1.0', root: { id: 'root', type: 'text', props: { content: 'Registration Form' } } };
const registrationCase = coverageCases[0];
const formCases = coverageCases.filter(item => item.expectation.scope === 'form');

function form(children: UiNode[]) {
  return { version: '1.0', root: { id: 'form', type: 'form', props: { label: 'Example form' }, children } };
}

function field(requirement: CoverageRequirement): UiNode {
  if (requirement.type === 'button') return { id: requirement.key, type: 'button', props: { label: requirement.buttonLabel ?? 'Send', type: requirement.buttonType ?? 'button' } };
  const type = requirement.type;
  if (type !== 'textInput' && type !== 'emailInput' && type !== 'passwordInput' && type !== 'checkbox') throw new Error('Expected a field');
  return { id: requirement.key, type, props: { name: requirement.key, label: requirement.key.replace(/-/g, ' ') } };
}

describe('semantic coverage is separate from structural validity', () => {
  it('reproduces the live failure: Zod accepts the summary, coverage fails all seven requirements', () => {
    expect(uiSpecificationSchema.safeParse(collapsed).success).toBe(true);
    expect(evaluateCoverage(collapsed, registrationCase.expectation)).toEqual({
      schemaValid: true, assessed: true, passed: false, coverage: 0,
      matched: [], missing: ['form', 'name', 'email', 'password', 'confirm-password', 'terms', 'submit'], unexpectedFieldIds: [],
    });
  });

  it('accepts the complete registration fixture and reports full coverage', () => {
    expect(evaluateCoverage(registration, registrationCase.expectation)).toMatchObject({ schemaValid: true, passed: true, coverage: 1, missing: [], unexpectedFieldIds: [] });
  });

  it.each(formCases)('extracts an explicit checklist independently authored for $id', ({ prompt, expectation }) => {
    const derived = deriveFormExpectation(prompt);
    expect(derived.scope).toBe('form');
    expect([...derived.requirements].sort((a, b) => a.key.localeCompare(b.key)))
      .toEqual([...expectation.requirements].sort((a, b) => a.key.localeCompare(b.key)));
  });

  it.each(formCases)('keeps offline field expectations independent from the model grammar for $id', ({ prompt, expectation }) => {
    expect(deriveFormExpectation(prompt).requirements.filter(item => item.type !== 'form'))
      .toEqual(expectation.requirements.filter(item => item.type !== 'form'));
  });

  it.each([
    ['Create a simple login form with email, password, and a Login button.', 'Login'],
    ['Build a basic form with email and a Sign in button.', 'Sign in'],
    ['Make a simple signup form with name, email, and a Register button.', 'Register'],
    ['Generate a basic registration form with email and a Sign up button.', 'Sign up'],
  ])('plans conventional named actions from %s without a form response template', (prompt, label) => {
    const expectation = deriveFormExpectation(prompt);
    expect(expectation.requirements.at(-1)).toMatchObject({ type: 'button', buttonType: 'submit', buttonLabel: label });
  });

  it.each(['Create a form with email and a Delete account button.',
    'Create a form with email and a Login button with a custom label.',
    'Create a form with email, a Login button, and a Login button.'])(
    'evaluates unknown or repeated actions without changing UI data: %s', prompt => {
      expect(evaluateCoverage(registration, deriveFormExpectation(prompt)).schemaValid).toBe(true);
    },
  );

  it('requires the requested named action label, not an unrelated submit label', () => {
    const expectation = coverageCases.find(item => item.id === 'simple-login')!.expectation;
    const output = form(expectation.requirements.filter(item => item.type !== 'form').map(field));
    const button = output.root.children.find(node => node.type === 'button')!;
    if (button.type !== 'button') throw new Error('Expected a button');
    button.props.label = 'Register';
    expect(evaluateCoverage(output, expectation).missing).toEqual(['login']);
  });

  it.each(['Create a form without password.', 'Create a form with email and phone number.',
    'Create a form with optional email and submit.', 'Create a form with email and a heading.',
    'Create a form with email in a horizontal layout.', 'Create a horizontal form with email.',
    'Create a form with email labeled Work address.', 'Create a registration form.', 'Create a form with email, email, and submit.'])(
    'never mutates valid UI when evaluating unknown fields or custom instructions in %j', prompt => {
      const original = structuredClone(registration);
      evaluateCoverage(registration, deriveFormExpectation(prompt));
      expect(registration).toEqual(original);
    },
  );

  it.each(formCases)('evaluates a complete $id form and catches each missing field/action', ({ expectation }) => {
    const controls = expectation.requirements.filter(item => item.type !== 'form');
    const complete = form(controls.map(field));
    expect(evaluateCoverage(complete, expectation).passed).toBe(true);
    for (const omitted of controls) {
      const incomplete = form(controls.filter(item => item.key !== omitted.key).map(field));
      const report = evaluateCoverage(incomplete, expectation);
      expect(report.schemaValid).toBe(true);
      expect(report.passed).toBe(false);
      expect(report.missing).toEqual([omitted.key]);
      expect(report.coverage).toBeLessThan(1);
    }
  });

  it('does not count one password control as both password and confirmation', () => {
    const output = structuredClone(registration);
    output.root.children[0].children = output.root.children[0].children.filter(item => item.id !== 'confirm-password');
    expect(evaluateCoverage(output, registrationCase.expectation).missing).toEqual(['confirm-password']);
  });

  it('does not count first name as a complete name field', () => {
    const output = form([{ id: 'first-name', type: 'textInput', props: { label: 'First name', name: 'first-name' } }]);
    expect(evaluateCoverage(output, { scope: 'form', requirements: [{ key: 'name', type: 'textInput', fieldRole: 'name' }] }).missing).toEqual(['name']);
  });

  it('recognizes repeat-password labels and preserves explicit confirmation-only requests', () => {
    const requirement: CoverageExpectation = { scope: 'form', requirements: [{ key: 'confirmation', type: 'passwordInput', fieldRole: 'confirm-password' }] };
    const output = form([{ id: 'repeat', type: 'passwordInput', props: { label: 'Repeat password', name: 'confirmation' } }]);
    expect(evaluateCoverage(output, requirement).passed).toBe(true);
    expect(deriveFormExpectation('Create a form with confirm password.').requirements.map(item => item.key)).toEqual(['form', 'confirm-password']);
  });

  it.each(['textInput', 'text'] as const)('does not accept %s as an email input just because it is named email', type => {
    const output = form([type === 'text' ? { id: 'email', type, props: { content: 'Email' } }
      : { id: 'email', type, props: { name: 'email', label: 'Email' } }]);
    expect(evaluateCoverage(output, { scope: 'form', requirements: [{ key: 'email', type: 'emailInput', fieldRole: 'email' }] }).passed).toBe(false);
  });

  it('requires an actual submit button; an ordinary button or a submit label does not count', () => {
    const output = form([{ id: 'send', type: 'button', props: { label: 'Submit', type: 'button' } }]);
    expect(evaluateCoverage(output, { scope: 'form', requirements: [{ key: 'submit', type: 'button', buttonType: 'submit' }] }).passed).toBe(false);
  });

  it('checks requested required flags when the evaluation explicitly specifies them', () => {
    const output = form([{ id: 'email', type: 'emailInput', props: { name: 'email', label: 'Email' } }]);
    expect(evaluateCoverage(output, { scope: 'form', requirements: [{ key: 'email', type: 'emailInput', fieldRole: 'email', required: true }] }).passed).toBe(false);
  });

  it('does not combine partial requirements across separate forms', () => {
    const output = { version: '1.0', root: { id: 'layout', type: 'verticalLayout', props: {}, children: [
      { id: 'form-one', type: 'form', props: { label: 'One' }, children: [{ id: 'email', type: 'emailInput', props: { name: 'email', label: 'Email' } }] },
      { id: 'form-two', type: 'form', props: { label: 'Two' }, children: [{ id: 'password', type: 'passwordInput', props: { name: 'password', label: 'Password' } }] },
    ] } };
    const report = evaluateCoverage(output, { scope: 'form', requirements: [
      { key: 'email', type: 'emailInput', fieldRole: 'email' }, { key: 'password', type: 'passwordInput', fieldRole: 'password' },
    ] });
    expect(report.schemaValid).toBe(true);
    expect(report.passed).toBe(false);
    expect(report.matched).toHaveLength(1);
  });

  it('flags copied registration fields when evaluating a simpler login request', () => {
    const loginCase = coverageCases.find(item => item.id === 'login')!;
    const report = evaluateCoverage(registration, loginCase.expectation);
    expect(report.coverage).toBe(1);
    expect(report.passed).toBe(false);
    expect(report.unexpectedFieldIds).toEqual(['name', 'confirm-password', 'terms']);
  });

  it('evaluates non-form layouts with human-authored expectations', () => {
    const expectation = coverageCases.find(item => item.id === 'horizontal-content')!.expectation;
    const output = { version: '1.0', root: { id: 'row', type: 'horizontalLayout', props: {}, children: [
      { id: 'heading', type: 'heading', props: { content: 'Title', level: 2 } },
      { id: 'description', type: 'text', props: { content: 'Description' } },
    ] } };
    expect(evaluateCoverage(output, expectation).passed).toBe(true);
    expect(evaluateCoverage(collapsed, expectation).passed).toBe(false);
  });

  it.each(['Explain a registration form with email.', 'Create a form without a password.', 'Show a heading.', 'If needed, create a form with email.'])(
    'abstains from automatic coverage claims for ambiguous/non-form input %j', prompt => {
      const expectation = deriveFormExpectation(prompt);
      expect(expectation).toEqual({ scope: 'general', requirements: [] });
      expect(evaluateCoverage(collapsed, expectation)).toMatchObject({ schemaValid: true, assessed: false, passed: false, coverage: null });
    },
  );

  it('does not invent fields from a form title or bind unrelated form controls together', () => {
    expect(deriveFormExpectation('Create a password reset form with email and submit.').requirements.map(item => item.key)).toEqual(['form', 'email', 'submit']);
    expect(deriveFormExpectation('Create a registration form.').requirements).toEqual([{ key: 'form', type: 'form' }]);
  });

  it('fails unsafe output before assessing even seemingly complete content', () => {
    const unsafe = structuredClone(registration);
    Object.assign(unsafe.root.props, { onSubmit: 'alert(1)' });
    expect(evaluateCoverage(unsafe, registrationCase.expectation)).toMatchObject({ schemaValid: false, passed: false, coverage: 0 });
  });

  it('counts distinct nodes for repeated component requirements', () => {
    const type: ComponentType = 'text';
    const expectation = { scope: 'general', requirements: [{ key: 'one', type }, { key: 'two', type }] } as const;
    expect(evaluateCoverage(collapsed, expectation).matched).toHaveLength(1);
  });
});
