import { describe, expect, it, vi } from 'vitest';
import { compileSemanticUiPlan, SemanticUiPlanCompilationError } from '../src/ai/compatibility/compileSemanticUiPlan';
import { semanticUiPlanSchema } from '../src/ai/compatibility/semanticUiPlan';
import type { SemanticUiElement, SemanticUiGroup, SemanticUiReference, SupportedSemanticUiPlan } from '../src/ai/compatibility/semanticUiPlan';
import { compileModelUi, ModelUiCompilationError } from '../src/ai/compileModelUi';
import { BASE_COMPONENT_TYPES as COMPONENT_TYPES, identifierSchema, SPEC_LIMITS } from '@vpds/ui-specification/componentRegistry';
import type { UiNode } from '@vpds/ui-specification/componentRegistry';
import { uiSpecificationSchema } from '@vpds/ui-specification/uiSpecification';

const e = (element: number): SemanticUiReference => ({ element });
const g = (group: number): SemanticUiReference => ({ group });
const text = (content = 'Hello'): SemanticUiElement => ({ type: 'text', props: { content } });
const field = (label: string): SemanticUiElement => ({ type: 'textInput', props: { label } });
const action = (type: 'button' | 'submit' | 'reset' = 'button', label = 'Action'): SemanticUiElement => ({ type: 'button', props: { label, type } });
const row = (members: SemanticUiReference[]): SemanticUiGroup => ({ kind: 'row', props: { gap: 'small' }, members });
const column = (members: SemanticUiReference[]): SemanticUiGroup => ({ kind: 'column', props: { gap: 'large' }, members });
const form = (members: SemanticUiReference[], label = 'Example'): SemanticUiGroup => ({ kind: 'form', props: { label }, members });
const plan = (elements: SemanticUiElement[], groups: SemanticUiGroup[] = [], content = elements.map((_, index) => e(index))): SupportedSemanticUiPlan =>
  ({ planVersion: '1', status: 'supported', elements, groups, content });
const flatten = (node: UiNode): UiNode[] => [node, ...(node.children?.flatMap(flatten) ?? [])];
const names = (node: UiNode): string[] => flatten(node).flatMap(item => 'name' in item.props ? [item.props.name] : []);
const semanticTree = (node: UiNode): unknown => ({ type: node.type,
  props: Object.fromEntries(Object.entries(node.props).filter(([key]) => key !== 'name')),
  ...(node.children ? { children: node.children.map(semanticTree) } : {}),
});
function rejects(input: unknown, message?: string) {
  expect(semanticUiPlanSchema.safeParse(input).success).toBe(false);
  try { compileSemanticUiPlan(input); throw new Error('Expected invalid semantic plan'); }
  catch (error) {
    expect(error).toBeInstanceOf(SemanticUiPlanCompilationError);
    if (!(error instanceof SemanticUiPlanCompilationError)) throw error;
    expect(error.stage).toBe('semantic_plan');
    if (message) expect(error.issues.some(issue => issue.message === message)).toBe(true);
  }
}

// Developer-owned compiler fixtures. Production code has no prompt-to-plan mappings.
function login() {
  return plan([
    { type: 'emailInput', props: { label: 'Email', required: true } },
    { type: 'passwordInput', props: { label: 'Password', required: true } },
    action('submit', 'Login'),
  ], [form([e(0), e(1), e(2)], 'Login')], [g(0)]);
}
function registration() {
  return plan([field('Name'),
    { type: 'emailInput', props: { label: 'Email' } },
    { type: 'passwordInput', props: { label: 'Password' } },
    { type: 'passwordInput', props: { label: 'Confirm password' } },
    { type: 'checkbox', props: { label: 'I agree to the terms', required: true } }, action('submit', 'Register'),
  ], [form([e(0), e(1), e(2), e(3), e(4), e(5)], 'Registration')], [g(0)]);
}
function contact() {
  return plan([field('Name'),
    { type: 'emailInput', props: { label: 'Email', placeholder: 'you@example.com', required: true } },
    { type: 'textInput', props: { label: 'Message', required: false, maxLength: 500 } }, action('submit', 'Send'),
  ], [form([e(0), e(1), e(2), e(3)], 'Contact')], [g(0)]);
}
function profile() {
  // Group declarations intentionally use forward and backward references.
  return plan([field('First name'), field('Last name'),
    { type: 'emailInput', props: { label: 'Email' } }, action('submit', 'Save Profile'),
  ], [form([g(2)], 'Profile'), row([e(0), e(1)]), column([g(1), e(2), e(3)])], [g(0)]);
}

describe('semantic plan composition and registry properties', () => {
  const leaves: SemanticUiElement[] = [
    { type: 'textInput', props: { label: 'Name', placeholder: 'Your name', maxLength: 42, required: false, disabled: false } },
    { type: 'emailInput', props: { label: 'Email', required: true, disabled: false } },
    { type: 'passwordInput', props: { label: 'Secret', maxLength: 72, disabled: true } },
    { type: 'checkbox', props: { label: 'Updates', required: false, disabled: false } },
    { type: 'button', props: { label: 'Continue', type: 'button', disabled: false } },
    text('  Literal paragraph  '), { type: 'heading', props: { content: 'Title', level: 3 } },
  ];
  it.each(leaves)('preserves $type and every explicit property without a root wrapper', element => {
    const output = compileSemanticUiPlan(plan([element]));
    expect(semanticTree(output.root)).toEqual(element);
    expect(output.root.id).toBe('node-0');
    expect(uiSpecificationSchema.safeParse(output).success).toBe(true);
  });
  it('covers all ten registered types without relying on form examples alone', () => {
    const input = plan(leaves.map(item => structuredClone(item)), [row([e(0), e(1)]), column([e(2), e(3)]), form([e(4)], 'Actions')], [g(0), g(1), g(2), e(5), e(6)]);
    expect([...new Set(flatten(compileSemanticUiPlan(input).root).map(node => node.type))].sort()).toEqual([...COMPONENT_TYPES].sort());
  });
  it.each([['login', login, ['emailInput', 'passwordInput', 'button']],
    ['registration', registration, ['textInput', 'emailInput', 'passwordInput', 'passwordInput', 'checkbox', 'button']],
    ['contact', contact, ['textInput', 'emailInput', 'textInput', 'button']],
  ] as const)('composes the complete %s fixture as a direct form without extra columns', (_name, fixture, types) => {
    const input = fixture(), output = compileSemanticUiPlan(input);
    expect(output.root.type).toBe('form');
    expect(output.root.children?.map(node => node.type)).toEqual(types);
    expect(output.root.children?.map(node => semanticTree(node))).toEqual(input.elements);
    expect(flatten(output.root)).toHaveLength(input.elements.length + 1);
  });
  it('preserves profile row siblings, spacing and the email below the entire row', () => {
    const output = compileSemanticUiPlan(profile());
    expect(semanticTree(output.root)).toEqual({ type: 'form', props: { label: 'Profile' }, children: [
      { type: 'verticalLayout', props: { gap: 'large' }, children: [
        { type: 'horizontalLayout', props: { gap: 'small' }, children: [field('First name'), field('Last name')] },
        { type: 'emailInput', props: { label: 'Email' } }, action('submit', 'Save Profile'),
      ] },
    ] });
    expect(flatten(output.root).map(node => node.id)).toEqual(['node-0', 'node-0-0', 'node-0-0-0', 'node-0-0-0-0', 'node-0-0-0-1', 'node-0-0-1', 'node-0-0-2']);
  });
  it('creates only one implicit column for multiple top-level items in content order', () => {
    const input = plan([text('Ready'), action('button', 'Inspect'), { type: 'heading', props: { content: 'Status', level: 2 } }], [row([e(0), e(1)])], [e(2), g(0)]);
    expect(semanticTree(compileSemanticUiPlan(input).root)).toEqual({ type: 'verticalLayout', props: {}, children: [
      input.elements[2], { type: 'horizontalLayout', props: { gap: 'small' }, children: [input.elements[0], input.elements[1]] },
    ] });
  });
  it('honors content/member order instead of sorting references by inventory index', () => {
    const input = plan([text('First inventory slot'), text('Second inventory slot'), text('Third inventory slot')], [row([e(2), e(0)])], [e(1), g(0)]);
    expect(flatten(compileSemanticUiPlan(input).root).filter(node => node.type === 'text').map(node => node.props.content))
      .toEqual(['Second inventory slot', 'Third inventory slot', 'First inventory slot']);
  });
  it('makes positional-reference editing risks explicit rather than guessing intended targets', () => {
    const original = plan([text('Alpha'), text('Beta')], [row([e(0), e(1)])], [g(0)]);
    const reordered = structuredClone(original);
    reordered.elements.reverse();
    // Still structurally valid, but unchanged indexes now select different content.
    expect(semanticUiPlanSchema.safeParse(reordered).success).toBe(true);
    expect(semanticTree(compileSemanticUiPlan(reordered).root)).not.toEqual(semanticTree(compileSemanticUiPlan(original).root));
    reordered.groups[0].members = [e(1), e(0)];
    // Updating references preserves the same UI, IDs, and properties after renumbering.
    expect(compileSemanticUiPlan(reordered)).toEqual(compileSemanticUiPlan(original));
  });
  it('preserves mixed row/column groupings and consumes every declaration exactly once', () => {
    const input = plan([text('Left'), text('Right'), action(), { type: 'checkbox', props: { label: 'Enabled' } }],
      [column([e(0), e(1)]), row([g(0), e(2)]), column([g(1), e(3)])], [g(2)]);
    const output = compileSemanticUiPlan(input), all = flatten(output.root);
    expect(all.map(node => node.type)).toEqual(['verticalLayout', 'horizontalLayout', 'verticalLayout', 'text', 'text', 'button', 'checkbox']);
    expect(all).toHaveLength(input.elements.length + input.groups.length);
    expect(new Set(all.map(node => node.id)).size).toBe(all.length);
  });
  it('preserves explicit single-child layouts and repeated directions with their gaps', () => {
    const input = plan([text()], [{ kind: 'column', props: { gap: 'none' }, members: [g(1)] }, column([e(0)])], [g(0)]);
    expect(semanticTree(compileSemanticUiPlan(input).root)).toEqual({ type: 'verticalLayout', props: { gap: 'none' }, children: [
      { type: 'verticalLayout', props: { gap: 'large' }, children: [text()] },
    ] });
  });
  it('does not invent optional properties or alter label whitespace', () => {
    const output = compileSemanticUiPlan(plan([field('  Full name  ')]));
    expect(output.root.props).toEqual({ label: '  Full name  ', name: 'full-name' });
  });
  it('keeps explicit false values present on fields, checkbox and buttons', () => {
    const input = plan([leaves[0], leaves[3], leaves[4]].map(item => structuredClone(item)));
    const output = compileSemanticUiPlan(input);
    expect(output.root.children?.[0].props).toMatchObject({ required: false, disabled: false, maxLength: 42 });
    expect(output.root.children?.[1].props).toMatchObject({ required: false, disabled: false });
    expect(output.root.children?.[2].props).toMatchObject({ disabled: false });
  });
});

describe('explicit form membership and deterministic identities', () => {
  it('supports separate forms, explicit action ownership and document-wide unique field names', () => {
    const input = plan([field('Email'), action('submit', 'Save'), field('Email'), action('reset', 'Clear')],
      [form([e(0), e(1)], 'First form'), form([e(2), e(3)], 'Second form')], [g(1), g(0)]);
    const output = compileSemanticUiPlan(input);
    expect(output.root.children?.map(node => node.props)).toEqual([{ label: 'Second form' }, { label: 'First form' }]);
    expect(output.root.children?.map(node => node.children?.[1].props)).toEqual([{ label: 'Clear', type: 'reset' }, { label: 'Save', type: 'submit' }]);
    expect(names(output.root)).toEqual(['email', 'email-2']);
  });
  it.each(['button', 'submit', 'reset'] as const)('preserves the explicit %s button type through form layout groups', type => {
    const input = plan([action(type)], [form([g(1)]), row([e(0)])], [g(0)]);
    expect(flatten(compileSemanticUiPlan(input).root).find(node => node.type === 'button')?.props).toEqual({ label: 'Action', type });
  });
  it('normalizes repeated and Unicode labels with the existing compiler without changing displayed labels', () => {
    const labels = ['Émail', 'E\u0301mail', 'Ｆｕｌｌ Ｎａｍｅ', '姓名', '123 Code', 'Email'];
    const output = compileSemanticUiPlan(plan(labels.map(field)));
    expect(names(output.root)).toEqual(['email', 'email-2', 'full-name', 'field', 'field-123-code', 'email-3']);
    names(output.root).forEach(name => expect(identifierSchema.safeParse(name).success).toBe(true));
    expect(output.root.children?.map(node => 'label' in node.props ? node.props.label : '')).toEqual(labels);
  });
  it('is deterministic, leaves input unchanged, and returns independent results', () => {
    const input = profile(), saved = structuredClone(input);
    const first = compileSemanticUiPlan(input), second = compileSemanticUiPlan(JSON.parse(JSON.stringify(input)));
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    first.root.props = { label: 'Changed output' };
    expect(input).toEqual(saved);
    expect(compileSemanticUiPlan(input)).toEqual(second);
  });
  it('matches the existing compiler on an equivalent manually authored draft', () => {
    const expected = compileModelUi({ irVersion: '1', status: 'supported', root: { type: 'form', props: { label: 'Login' }, children: login().elements } });
    expect(compileSemanticUiPlan(login())).toEqual(expected);
  });
  it.each(['submit', 'reset'] as const)('rejects an unscoped %s action instead of inserting a form or changing type', type => {
    const input = plan([action(type)]), saved = structuredClone(input);
    rejects(input, 'Submit/reset buttons require explicit form membership.');
    expect(input).toEqual(saved);
  });
  it('does not attach a stray action to another form in the document', () => {
    rejects(plan([field('Email'), action('submit')], [form([e(0)])], [g(0), e(1)]), 'Submit/reset buttons require explicit form membership.');
  });
  it.each([false, true])('rejects nested forms, through layout = %s', throughLayout => {
    const groups = throughLayout ? [form([g(1)]), column([g(2)]), form([e(0)])] : [form([g(1)]), form([e(0)])];
    rejects(plan([text()], groups, [g(0)]), 'Form groups cannot be nested.');
  });
});

describe('cross-array reference integrity', () => {
  it.each([-1, .5, 100, NaN, Infinity, '0', null, undefined])('rejects malformed indexes %#', index => {
    rejects({ ...plan([text()]), content: [{ element: index }] });
  });
  it.each([{ element: 1 }, { group: 0 }])('rejects well-typed indexes outside the actual array: %j', ref => {
    rejects({ ...plan([text()]), content: [ref] }, 'The reference index is outside its declared array.');
  });
  it.each([g(-1), g(1.5), e(-1), e(1.5)])('rejects invalid member indexes before ownership/cycle traversal: %j', ref => {
    // All valid entries already have one owner; negative indexes must not create
    // hidden array properties or reach a group lookup while Zod collects issues.
    rejects(plan([text()], [row([e(0), ref])], [g(0)]));
  });
  it('checks references inside unreachable groups before dereferencing them', () => {
    const input = plan([text()], [row([e(99)])]);
    const parsed = semanticUiPlanSchema.safeParse(input);
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues).toContainEqual(expect.objectContaining({ path: ['groups', 0, 'members', 0, 'element'] }));
    rejects(input);
  });
  it.each([{}, { element: 0, group: 0 }, { element: 0, extra: true }, { index: 0 }, 0, 'element:0'])('rejects malformed reference objects %#', ref => {
    rejects({ ...plan([text()]), content: [ref] });
  });
  it.each([
    () => plan([text()], [], [e(0), e(0)]),
    () => plan([text()], [row([e(0), e(0)])], [g(0)]),
    () => plan([text()], [row([e(0)])], [g(0), e(0)]),
    () => plan([text()], [row([e(0)])], [g(0), g(0)]),
    () => plan([text()], [row([e(0)]), column([e(0)])], [g(0), g(1)]),
    () => plan([text()], [row([e(0)]), column([g(0)])], [g(0), g(1)]),
    () => plan([field('Shared')], [form([e(0)]), form([e(0)])], [g(0), g(1)]),
  ])('rejects duplicate ownership/conflicting relationships %#', fixture => {
    rejects(fixture(), 'Every element and group must have exactly one reference.');
  });
  it.each([
    () => plan([text('Visible'), text('Unreachable')], [], [e(0)]),
    () => plan([text()], [row([e(0)])], [e(0)]),
    () => plan([text('Visible'), text('Unreachable member')], [row([e(1)])], [e(0)]),
  ])('rejects unreachable elements/groups/branches instead of dropping them %#', fixture => {
    rejects(fixture(), 'Every element and group must have exactly one reference.');
  });
  it.each([
    () => plan([text()], [row([e(0), g(0)])], [g(0)]),
    () => plan([text()], [row([g(1)]), column([g(0), e(0)])], [g(0)]),
    // This disconnected cycle has exactly one reference per element/group.
    () => plan([text()], [row([g(1)]), column([g(0)])], [e(0)]),
  ])('rejects reachable and disconnected cycles %#', fixture => {
    rejects(fixture(), 'Groups must not form cycles.');
  });
});

describe('plan complexity and strict data boundaries', () => {
  function chain(groupCount: number, extraRoot = false) {
    return plan(extraRoot ? [text(), text('Other')] : [text()],
      Array.from({ length: groupCount }, (_, index) => column([index === groupCount - 1 ? e(0) : g(index + 1)])),
      extraRoot ? [g(0), e(1)] : [g(0)]);
  }
  it('accepts exactly 100 composed nodes, including an implicit or explicit root', () => {
    expect(flatten(compileSemanticUiPlan(plan(Array.from({ length: 99 }, () => text()))).root)).toHaveLength(100);
    const input = plan(Array.from({ length: 99 }, () => text()), [form(Array.from({ length: 99 }, (_, index) => e(index)))], [g(0)]);
    expect(flatten(compileSemanticUiPlan(input).root)).toHaveLength(100);
  });
  it('rejects 100 leaves plus an implicit root instead of dropping the last item', () => {
    rejects(plan(Array.from({ length: 100 }, () => text())), 'The composed UI exceeds the component limit, including its implicit root.');
  });
  it('counts explicit groups against the same total budget', () => {
    rejects(plan(Array.from({ length: 100 }, () => text()), [column(Array.from({ length: 100 }, (_, index) => e(index)))], [g(0)]));
  });
  it('accepts depth six and rejects seven, accounting for the implicit root', () => {
    expect(flatten(compileSemanticUiPlan(chain(5)).root)).toHaveLength(SPEC_LIMITS.maxDepth);
    expect(uiSpecificationSchema.safeParse(compileSemanticUiPlan(chain(4, true))).success).toBe(true);
    rejects(chain(6), 'The composed UI exceeds the nesting limit.');
    rejects(chain(5, true), 'The composed UI exceeds the nesting limit.');
  });
  it.each(['select', 'textarea', 'image', 'Input', 'form', 'verticalLayout'])('rejects unsupported/misplaced element type %s', type => {
    rejects({ ...plan([text()]), elements: [{ type, props: { label: 'Example' } }] });
  });
  it.each(['grid', 'table', 'horizontalLayout'])('rejects unsupported group kind %s', kind => {
    rejects({ ...plan([text()], [row([e(0)])], [g(0)]), groups: [{ kind, props: {}, members: [e(0)] }] });
  });
  it.each([
    null, undefined, [], {},
    { ...plan([text()]), planVersion: '2' }, { ...plan([text()]), extra: true },
    { ...plan([text()]), elements: [] }, { ...plan([text()]), content: [] },
    { ...plan([text()]), groups: undefined },
    { ...plan([text()]), elements: [{ type: 'textInput', props: {} }] },
    { ...plan([text()]), elements: [{ type: 'textInput', id: 'own-id', props: { label: 'Name' } }] },
    { ...plan([text()]), elements: [{ type: 'textInput', props: { label: 'Name', name: 'own-name' } }] },
    { ...plan([text()]), elements: [{ type: 'textInput', props: { label: 'Name', disabled: null } }] },
    { ...plan([text()]), elements: [{ type: 'textInput', props: { label: 'Name', required: 'false' } }] },
    { ...plan([text()]), elements: [{ type: 'textInput', props: { label: 'Name', placeholder: null } }] },
    { ...plan([text()]), elements: [{ type: 'button', props: { label: 'Action' } }] },
    { ...plan([text()]), elements: [{ type: 'heading', props: { content: 'Title', level: 5 } }] },
    { ...plan([text()]), elements: [{ ...text(), children: [] }] },
    plan([text()], [{ kind: 'row', props: { gap: 'small' }, members: [] }], [g(0)]),
    { ...plan([text()], [row([e(0)])], [g(0)]), groups: [{ kind: 'row', props: { gap: 'huge' }, members: [e(0)] }] },
    { ...plan([text()], [form([e(0)])], [g(0)]), groups: [{ kind: 'form', props: {}, members: [e(0)] }] },
    { ...plan([text()], [form([e(0)])], [g(0)]), groups: [{ kind: 'form', props: { label: 'Form', gap: 'large' }, members: [e(0)] }] },
  ])('rejects malformed shape, unknown props, and missing props %#', input => rejects(input));
  it.each([
    { onClick: 'alert(1)' }, { style: { color: 'red' } }, { className: 'custom' },
    { imports: ['unsafe'] }, { dangerouslySetInnerHTML: { __html: 'unsafe' } }, { expression: 'run()' },
  ])('rejects executable/styling properties %#', props => {
    rejects({ ...plan([text()]), elements: [{ type: 'textInput', props: { label: 'Example', ...props } }] });
  });
  it.each(['<script>bad</script>', '{expression}', '`template`', 'x => x', '   ', 'a'.repeat(1001)])('keeps the existing literal-text restrictions %#', content => {
    rejects({ ...plan([text()]), elements: [{ type: 'text', props: { content } }] });
  });
  it('bounds malformed JavaScript input without invoking accessors', () => {
    const getter = vi.fn(() => '1');
    const cycle: Record<string, unknown> = {}; cycle.self = cycle;
    const accessor = Object.defineProperty({}, 'planVersion', { enumerable: true, get: getter });
    const nested = { ...plan([text()]), elements: [{ type: 'text', props: Object.defineProperty({}, 'content', { enumerable: true, get: getter }) }] };
    const shared = text();
    for (const input of [cycle, accessor, nested, plan([shared, shared]),
      { ...plan([text()]), elements: new Array(1) }, new Date(), new Map(), 1n,
      { ...plan([text()]), elements: [{ type: 'text', props: { content: () => 'unsafe' } }] },
      Object.assign(plan([text()]), { [Symbol('unexpected')]: 'value' }),
      Array.from({ length: 5000 }, () => null),
    ]) rejects(input);
    expect(getter).not.toHaveBeenCalled();
  });
  it.each(['unsupported-component', 'unsupported-behavior'])('keeps explicit %s outcomes separate from valid UI', reason => {
    const input = { planVersion: '1', status: 'unsupported', reason };
    expect(semanticUiPlanSchema.parse(input)).toEqual(input);
    try { compileSemanticUiPlan(input); throw new Error('Expected explicit unsupported outcome'); }
    catch (error) { expect(error).toBeInstanceOf(ModelUiCompilationError); expect((error as ModelUiCompilationError).stage).toBe('unsupported_request'); }
  });
  it.each([
    { planVersion: '1', status: 'unsupported', reason: 'private explanation' },
    { planVersion: '1', status: 'unsupported', reason: 'unsupported-component', elements: [] },
    { planVersion: '1', status: 'unsupported', reason: 'unsupported-component', content: [] },
    { planVersion: '1', status: 'unsupported', reason: 'unsupported-component', message: 'details' },
    { ...plan([text()]), reason: 'unsupported-component' },
  ])('rejects malformed/mixed unsupported outcomes %#', input => rejects(input));
});
