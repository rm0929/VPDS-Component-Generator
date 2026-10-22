import { describe, expect, it, vi } from 'vitest';
import { compileModelUi, ModelUiCompilationError } from '../src/ai/compileModelUi';
import { modelUiDraftSchema } from '../src/ai/modelUiDraft';
import type { DraftNode } from '../src/ai/modelUiDraft';
import type { UiNode } from '@vpds/ui-specification/componentRegistry';
import { identifierSchema, SPEC_LIMITS } from '@vpds/ui-specification/componentRegistry';
import { uiSpecificationSchema } from '@vpds/ui-specification/uiSpecification';
import { coverageCases } from '../../../tools/evaluation/coverage/coverageCases';
import { evaluateCoverage } from '../../../tools/evaluation/coverage/requirementCoverage';
import registration from '../src/ai/compatibility/fixtures/registration-draft.json';
import login from './fixtures/login-draft.json';
import contact from './fixtures/contact-draft.json';

const text = (): DraftNode => ({ type: 'text', props: { content: 'Hello' } });
const draft = (root: unknown) => ({ irVersion: '1', status: 'supported', root });
const layout = (children: unknown[]) => ({ type: 'verticalLayout', props: {}, children });
const field = (label: string) => ({ type: 'textInput', props: { label } });
const flatten = (node: UiNode): UiNode[] => [node, ...(node.children?.flatMap(flatten) ?? [])];
const names = (output: unknown) => flatten(compileModelUi(output).root).flatMap(node => 'name' in node.props ? [node.props.name] : []);
function semanticTree(node: UiNode | DraftNode): unknown {
  const props = Object.fromEntries(Object.entries(node.props).filter(([key]) => key !== 'name'));
  return { type: node.type, props, ...(node.children ? { children: node.children.map(semanticTree) } : {}) };
}

describe('pure UI draft compiler', () => {
  const nodes: DraftNode[] = [
    { type: 'textInput', props: { label: 'Name', placeholder: 'Your name', maxLength: 42, required: false, disabled: false } },
    { type: 'emailInput', props: { label: 'Email', required: true } },
    { type: 'passwordInput', props: { label: 'Password', disabled: true } },
    { type: 'checkbox', props: { label: 'Terms', required: false, disabled: false } },
    { type: 'button', props: { label: 'Press', type: 'button', disabled: false } },
    text(), { type: 'heading', props: { content: 'Title', level: 3 } },
    { type: 'verticalLayout', props: { gap: 'none' }, children: [text()] },
    { type: 'horizontalLayout', props: { gap: 'large' }, children: [text()] },
    { type: 'form', props: { label: 'Example' }, children: [text()] },
  ];
  it.each(nodes)('preserves every semantic property of $type', node => {
    const output = compileModelUi(draft(node));
    expect(semanticTree(output.root)).toEqual(semanticTree(node));
    expect(output.root.id).toBe('node-0');
    expect(uiSpecificationSchema.safeParse(output).success).toBe(true);
  });

  it.each([['registration', registration], ['simple-login', login], ['contact', contact]] as const)(
    'compiles complete %s forms and preserves order, nesting, and properties', (id, input) => {
      const output = compileModelUi(input);
      const parsed = modelUiDraftSchema.parse(input);
      if (parsed.status !== 'supported') throw new Error('Expected supported fixture');
      expect(semanticTree(output.root)).toEqual(semanticTree(parsed.root));
      expect(evaluateCoverage(output, coverageCases.find(item => item.id === id)!.expectation).passed).toBe(true);
      const all = flatten(output.root);
      expect(new Set(all.map(node => node.id)).size).toBe(all.length);
      expect(new Set(names(input)).size).toBe(names(input).length);
    },
  );

  it('uses structural positions across nested branches, including identical nodes', () => {
    const output = compileModelUi(draft(layout([layout([text(), text()]), text()])));
    expect(flatten(output.root).map(node => node.id)).toEqual(['node-0', 'node-0-0', 'node-0-0-0', 'node-0-0-1', 'node-0-1']);
  });

  it('is deterministic across repeated calls/property order and does not mutate or share input', () => {
    const input = structuredClone(login);
    const original = structuredClone(input);
    const first = compileModelUi(input);
    const second = compileModelUi(JSON.parse(JSON.stringify(input)));
    expect(first).toEqual(second);
    expect(compileModelUi({ root: input.root, status: 'supported', irVersion: '1' })).toEqual(first);
    first.root.props = { label: 'Changed' };
    expect(input).toEqual(original);
    expect(compileModelUi(input)).toEqual(second);
  });

  it.each([
    [['Email', 'Email', 'email-2', 'Email'], ['email', 'email-2', 'email-2-2', 'email-3']],
    [['Émail', 'E\u0301mail', 'Ｆｕｌｌ Ｎａｍｅ'], ['email', 'email-2', 'full-name']],
    [['姓名', '🔒', '123 Code', '---'], ['field', 'field-2', 'field-123-code', 'field-3']],
    [['Confirm Password', 'I agree to the terms'], ['confirm-password', 'i-agree-to-the-terms']],
  ])('normalizes and resolves label collisions %j', (labels, expected) => {
    const input = draft(layout(labels.map(field)));
    expect(names(input)).toEqual(expected);
    names(input).forEach(name => expect(identifierSchema.safeParse(name).success).toBe(true));
  });

  it('resolves long-label truncation collisions within 64 characters', () => {
    const input = draft(layout([field('A'.repeat(200)), field('A'.repeat(199) + 'B'), field('A'.repeat(200))]));
    expect(names(input)).toEqual(['a'.repeat(64), 'a'.repeat(62) + '-2', 'a'.repeat(62) + '-3']);
  });

  it('allocates names document-wide, including across separate forms', () => {
    const form = () => ({ type: 'form', props: { label: 'Form' }, children: [field('Email')] });
    expect(names(draft(layout([form(), form()])))).toEqual(['email', 'email-2']);
  });

  it.each(['button', 'submit', 'reset'] as const)('preserves button type %s', type => {
    const output = compileModelUi(draft({ type: 'form', props: { label: 'Actions' }, children: [{ type: 'button', props: { label: 'Action', type } }] }));
    expect(output.root.children?.[0].props).toEqual({ label: 'Action', type });
  });

  it('accepts exactly 100 nodes and depth six', () => {
    expect(flatten(compileModelUi(draft(layout(Array.from({ length: 99 }, text)))).root)).toHaveLength(100);
    let root = text();
    for (let depth = 1; depth < SPEC_LIMITS.maxDepth; depth++) root = { type: 'verticalLayout', props: {}, children: [root] };
    expect(flatten(compileModelUi(draft(root)).root)).toHaveLength(6);
  });

  it('rejects document-wide counts, not just individual child-array limits', () => {
    const root = layout([layout(Array.from({ length: 49 }, text)), layout(Array.from({ length: 49 }, text))]);
    expect(() => compileModelUi(draft(root))).toThrow(ModelUiCompilationError);
  });

  it('rejects depth seven rather than flattening the tree', () => {
    let root = text();
    for (let depth = 1; depth < 7; depth++) root = { type: 'verticalLayout', props: {}, children: [root] };
    expect(() => compileModelUi(draft(root))).toThrow(ModelUiCompilationError);
  });

  it.each([
    null, [], {}, { irVersion: '2', status: 'supported', root: text() },
    { irVersion: '1', status: 'supported', root: text(), extra: true },
    draft({ ...text(), id: 'root' }), draft({ type: 'input', props: { label: 'Name' } }),
    draft({ type: 'select', props: { label: 'Country' } }), draft({ type: 'emailInput', props: { label: 'Email', name: 'email' } }),
    draft({ type: 'button', props: { label: 'Send' } }), draft({ type: 'textInput', props: {} }),
    draft({ type: 'textInput', props: { label: 'Email', disabled: null } }),
    draft({ type: 'textInput', props: { label: 'Email', required: 'false' } }),
    draft({ type: 'textInput', props: { label: 'Email', onChange: 'alert(1)' } }),
    draft({ type: 'textInput', props: { label: 'Email', style: { color: 'red' } } }),
    draft({ type: 'textInput', props: { label: 'Email', placeholder: null } }),
    draft({ ...text(), children: [] }), draft(layout([])), draft({ type: 'horizontalLayout', props: { gap: 'huge' }, children: [text()] }),
    draft({ type: 'text', props: { content: '<script>evil</script>' } }),
    draft({ type: 'heading', props: { content: 'Title', level: 5 } }),
    draft(layout([text(), { type: 'unsupported', props: {} }])),
  ])('rejects invalid draft %# without dropping or repairing data', input => {
    expect(() => compileModelUi(input)).toThrow(ModelUiCompilationError);
  });

  it.each([
    draft({ type: 'form', props: { label: 'Outer' }, children: [{ type: 'form', props: { label: 'Inner' }, children: [text()] }] }),
    draft({ type: 'form', props: { label: 'Outer' }, children: [layout([{ type: 'form', props: { label: 'Inner' }, children: [text()] }])] }),
    draft({ type: 'button', props: { label: 'Send', type: 'submit' } }),
    draft(layout([{ type: 'button', props: { label: 'Reset', type: 'reset' } }])),
  ])('rejects invalid semantic relationships through authoritative Zod %#', input => {
    try { compileModelUi(input); throw new Error('Expected invalid relationships'); }
    catch (error) { expect(error).toBeInstanceOf(ModelUiCompilationError); expect((error as ModelUiCompilationError).stage).toBe('ui_schema'); }
  });

  it.each(['unsupported-component', 'unsupported-behavior'])('accepts explicit %s as an unsupported outcome, not UI', reason => {
    try { compileModelUi({ irVersion: '1', status: 'unsupported', reason }); throw new Error('Expected unsupported outcome'); }
    catch (error) { expect(error).toBeInstanceOf(ModelUiCompilationError); expect((error as ModelUiCompilationError).stage).toBe('unsupported_request'); }
  });

  it.each([
    { irVersion: '1', status: 'unsupported', reason: 'private explanation' },
    { irVersion: '1', status: 'unsupported', reason: 'unsupported-component', root: text() },
    { irVersion: '1', status: 'unsupported', reason: 'unsupported-component', message: 'private' },
    { irVersion: '1', status: 'supported', reason: 'unsupported-component', root: text() },
  ])('rejects malformed/mixed unsupported outcomes %#', input => expect(() => compileModelUi(input)).toThrow(ModelUiCompilationError));

  it('rejects cycles, getters, shared objects, sparse arrays, and non-JSON inputs before traversal', () => {
    const getter = vi.fn(() => text());
    const cycle: Record<string, unknown> = {}; cycle.self = cycle;
    const accessor = Object.defineProperty({}, 'root', { enumerable: true, get: getter });
    const shared = text();
    for (const input of [cycle, accessor, draft(layout([shared, shared])), draft(layout(new Array(2))),
      new Date(), draft({ type: 'text', props: { content: undefined } }), draft({ type: 'text', props: { content: () => 'Hi' } }),
      draft({ type: 'textInput', props: { label: 'Name', maxLength: Infinity } }), Array.from({ length: 5000 }, () => null)]) {
      expect(() => compileModelUi(input)).toThrow(ModelUiCompilationError);
    }
    expect(getter).not.toHaveBeenCalled();
  });
});
