import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { compileSelectionPoc, selectionSchema, selectionStructureSchema, SelectionPocError, LEAF_TYPES, MAX_SELECTIONS, DEFAULT_FORM_LABEL } from '../evaluation/selection-poc/selection';
import type { SelectionPoc } from '../evaluation/selection-poc/selection';
import { buildSelectionModelSchema, selectionMessages } from '../evaluation/selection-poc/model';
import { describePocFailure } from '../evaluation/selection-poc/diagnostics';
import { draftPropsSchemas } from '../src/modelUiDraft';
import { uiSpecificationSchema } from '../../src/specification/uiSpecification';
import type { UiNode } from '../../src/specification/componentRegistry';
import { buildPresentation } from '../../src/specification/presentation';
import { generateTsx } from '../../src/specification/generateTsx';
import { checkGeneratedTsx } from '../evaluation/selection-poc/checkTsx';
import dataset from '../evaluation/selection-poc/cases-v1.json';
import { feasibilityCases } from '../evaluation/selection-poc/feasibilityCases';
import { hash } from '../evaluation/metadata';

const selection = (components: unknown[], extra = {}) => ({ version: 'selection-poc-2', components, form: { enabled: false, label: null }, unsupported: [], ...extra });
const field = (label = 'Name') => ({ type: 'textInput' as const, props: { label, required: false, disabled: false } });
const text = (content = 'Hello') => ({ type: 'text' as const, props: { content } });
const flatten = (node: UiNode): UiNode[] => [node, ...(node.children?.flatMap(flatten) ?? [])];
const semantic = (node: UiNode): unknown => ({ type: node.type,
  props: Object.fromEntries(Object.entries(node.props).filter(([key]) => key !== 'name')),
  ...(node.children ? { children: node.children.map(semantic) } : {}),
});
const leaves: SelectionPoc['components'] = [field(),
  { type: 'emailInput', props: { label: 'Email', placeholder: 'you@example.com', required: true } },
  { type: 'passwordInput', props: { label: 'Secret', maxLength: 72, disabled: true } },
  { type: 'checkbox', props: { label: 'Updates', required: false, disabled: false } },
  { type: 'button', props: { label: 'Continue', type: 'button', disabled: false } },
  text(), { type: 'heading', props: { content: 'Title', level: 2 } },
];

describe('flat SelectionPoC contract and deterministic composition', () => {
  it.each(leaves)('preserves $type properties and explicit false with no unnecessary wrapper', component => {
    const output = compileSelectionPoc(selection([component]));
    expect(semantic(output.root)).toEqual(component);
    expect(uiSpecificationSchema.safeParse(output).success).toBe(true);
  });
  it('stacks blocks vertically, groups adjacent runs and keeps email after the row', () => {
    const input = selection([field('First name'), { ...field('Last name'), besidePrevious: true },
      { type: 'emailInput', props: { label: 'Email' } }, { type: 'button', props: { label: 'Save', type: 'submit' } },
    ], { form: { enabled: true, label: 'Details' } });
    const output = compileSelectionPoc(input);
    expect(semantic(output.root)).toEqual({ type: 'form', props: { label: 'Details' }, children: [
      { type: 'verticalLayout', props: { gap: 'medium' }, children: [
        { type: 'horizontalLayout', props: { gap: 'medium' }, children: [field('First name'), field('Last name')] },
        { type: 'emailInput', props: { label: 'Email' } }, { type: 'button', props: { label: 'Save', type: 'submit' } },
      ] },
    ] });
  });
  it('extends one row without nesting and starts a second adjacent row after false', () => {
    const output = compileSelectionPoc(selection([text('A'), { ...text('B'), besidePrevious: true },
      { ...text('C'), besidePrevious: true }, { ...text('D'), besidePrevious: false }, { ...text('E'), besidePrevious: true }]));
    expect(output.root.children?.map(node => node.type)).toEqual(['horizontalLayout', 'horizontalLayout']);
    expect(output.root.children?.map(node => node.children?.length)).toEqual([3, 2]);
    expect(flatten(output.root).filter(node => node.type === 'text').map(node => node.props.content)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
  it.each([false, true])('keeps ordinary buttons outside forms with disabled=%s', disabled => {
    const output = compileSelectionPoc(selection([{ type: 'button', props: { label: 'Action', type: 'button', disabled } }]));
    expect(output.root).toMatchObject({ type: 'button', props: { type: 'button', disabled } });
  });
  it('creates a form from enabled=true even with a missing name, using an explicit accessible default', () => {
    const input = selection([field()], { form: { enabled: true, label: null } });
    const before = JSON.stringify(input);
    const output = compileSelectionPoc(input);
    expect(output.root).toMatchObject({ type: 'form', props: { label: DEFAULT_FORM_LABEL } });
    expect(buildPresentation(output)).toMatchObject({ tag: 'form', props: { 'aria-label': DEFAULT_FORM_LABEL } });
    expect(JSON.stringify(input)).toBe(before);
  });
  it('preserves a valid supplied accessible name exactly, independent of the selected field labels', () => {
    expect(compileSelectionPoc(selection([field('Other')], { form: { enabled: true, label: '  Editor  ' } })).root.props)
      .toEqual({ label: '  Editor  ' });
  });
  it.each([undefined, null, {}, { enabled: true }, { label: null }, { enabled: 'true', label: null },
    { enabled: true, label: '' }, { enabled: true, label: '   ' }, { enabled: true, label: '<form>' },
    { enabled: true, label: 'x'.repeat(201) }, { enabled: false, label: 'Unused label' },
    { enabled: true, label: null, onSubmit: 'unsafe' }])('rejects invalid form declarations %#', form => {
    expect(() => compileSelectionPoc(selection([field()], { form }))).toThrow(SelectionPocError);
  });
  it('rejects legacy formLabel instead of silently converting it into structure', () => {
    expect(() => compileSelectionPoc(selection([field()], { formLabel: 'Legacy' }))).toThrow(SelectionPocError);
  });
  it.each(['submit', 'reset', 'button'])('preserves %s type within the optional enclosing form', type => {
    const output = compileSelectionPoc(selection([{ type: 'button', props: { label: 'Action', type, disabled: false } }], { form: { enabled: true, label: 'Actions' } }));
    expect(output.root).toMatchObject({ type: 'form', children: [{ type: 'button', props: { type, disabled: false } }] });
  });
  it('generates stable unique IDs/names for repeated and Unicode labels, without mutating input', () => {
    const input = selection([field('Café'), field('Cafe'), field('Café'), field('雪'), field('123')]);
    const before = JSON.stringify(input);
    const output = compileSelectionPoc(input);
    expect(output).toEqual(compileSelectionPoc(input));
    expect(JSON.stringify(input)).toBe(before);
    const nodes = flatten(output.root);
    expect(new Set(nodes.map(node => node.id)).size).toBe(nodes.length);
    expect(nodes.flatMap(node => 'name' in node.props ? [node.props.name] : [])).toEqual(['cafe', 'cafe-2', 'cafe-3', 'field', 'field-123']);
  });
  it('supports twenty selected leaves including the maximum number of row wrappers', () => {
    const input = selection(Array.from({ length: MAX_SELECTIONS }, (_, i) => ({ ...field('Code'), besidePrevious: i % 2 === 1 })), { form: { enabled: true, label: 'Codes' } });
    expect(flatten(compileSelectionPoc(input).root)).toHaveLength(32);
  });
  it('derives the grammar and seven property schemas from the reused validators', () => {
    expect(buildSelectionModelSchema()).toEqual(z.toJSONSchema(selectionStructureSchema, { target: 'draft-07' }));
    expect(buildSelectionModelSchema().required).toContain('form');
    expect(hash(JSON.stringify(buildSelectionModelSchema()))).toBe('385bab39b1c0e9fe1f9b3f1da0f1011cb76a34f43edfc1f33e04ad30854d23ad');
    expect(hash(JSON.stringify(selectionMessages()))).toBe('c50372ff66d3568ad1da08a7040fbe933fda546f3a6e44d92d9993a89f65700f');
    expect(leaves.map(item => item.type)).toEqual([...LEAF_TYPES]);
    for (const leaf of leaves) expect(draftPropsSchemas[leaf.type].safeParse(leaf.props).success).toBe(true);
    const examples = selectionMessages().filter(message => message.role === 'assistant');
    for (const example of examples) expect(() => compileSelectionPoc(JSON.parse(example.content))).not.toThrow();
    for (const testCase of feasibilityCases) expect(JSON.stringify(selectionMessages())).not.toContain(testCase.prompt);
    for (const testCase of dataset.cases) expect(JSON.stringify(selectionMessages())).not.toContain(testCase.prompt);
  });
});

describe('strict invalid selections and safe errors', () => {
  it.each([
    null, {}, selection([]), selection([text()], { version: 'v2' }),
    selection([{ type: 'select', props: { label: 'Country' } }]),
    selection([{ type: 'form', props: { label: 'Form' } }]),
    selection([{ ...field(), id: 'model-owned' }]),
    selection([{ type: 'textInput', props: { label: 'Name', name: 'model-owned' } }]),
    selection([{ type: 'textInput', props: { label: 'Name', disabled: null } }]),
    selection([{ type: 'textInput', props: { label: 'Name', required: 'false' } }]),
    selection([{ type: 'textInput', props: { label: 'Name', maxLength: 0 } }]),
    selection([{ type: 'heading', props: { content: 'Title', level: 5 } }]),
    selection([{ type: 'button', props: { label: 'Action' } }]),
    selection([{ ...text(), besidePrevious: true }]),
    selection([{ ...text(), besidePrevious: 'true' }]),
    selection([{ ...text(), children: [] }]), selection([text()], { css: 'display:grid' }),
    selection([text('<script>bad</script>')]), selection([text('')]), selection([text('x'.repeat(1001))]),
    selection([field('x'.repeat(201))]), selection([text()], { form: { enabled: true, label: '' } }),
    selection([text()], { unsupported: ['arbitrary refusal'] }),
    selection([text()], { unsupported: ['component', 'component'] }),
    selection(Array.from({ length: 21 }, () => text())),
  ])('rejects malformed data without repair %#', input => {
    expect(() => compileSelectionPoc(input)).toThrow(SelectionPocError);
    try { compileSelectionPoc(input); } catch (error) { expect(describePocFailure(error).stage).toBe('selection_schema'); }
  });
  it.each(['onClick', 'onChange', 'style', 'className', 'dangerouslySetInnerHTML', 'value', 'checked', 'href'])(
    'rejects unsupported/executable property %s', key => {
      expect(() => compileSelectionPoc(selection([{ type: 'textInput', props: { label: 'Name', [key]: 'PRIVATE' } }]))).toThrow(SelectionPocError);
    },
  );
  it.each(['submit', 'reset'])('rejects %s without a declared form at the actual property path', type => {
    try { compileSelectionPoc(selection([{ type: 'button', props: { label: 'PRIVATE', type } }])); throw new Error('Expected failure'); }
    catch (error) { expect(describePocFailure(error)).toEqual({ stage: 'composition', issues: [
      { path: ['components', 0, 'props', 'type'], code: 'custom', message: 'Submit/reset buttons require a declared form.' },
    ] }); }
  });
  it.each(['component', 'property', 'behavior', 'composition'])('never returns partial UI for unsupported %s', category => {
    try { compileSelectionPoc(selection([text('PRIVATE')], { unsupported: [category] })); throw new Error('Expected failure'); }
    catch (error) { expect(describePocFailure(error)).toEqual({ stage: 'unsupported', unsupported: [category], issues: [] }); }
  });
  it('permits an empty component list only with an explicit unsupported outcome', () => {
    expect(selectionSchema.safeParse(selection([], { unsupported: ['component'] })).success).toBe(true);
    expect(() => compileSelectionPoc(selection([], { unsupported: ['component'] }))).toThrow(SelectionPocError);
  });
  it('rejects cycles, object aliases, getters, non-JSON values, excessive nesting and JSON budgets without evaluation', () => {
    const getter = vi.fn(() => 'PRIVATE');
    const accessor = Object.defineProperty({}, 'version', { get: getter, enumerable: true });
    const cycle: unknown[] = []; cycle.push(cycle);
    const alias = text();
    const deep = Array.from({ length: 10 }).reduce<unknown>(value => [value], null);
    for (const input of [accessor, cycle, selection([alias, alias]), selection([text()], { value: () => 1 }),
      selection([text()], { value: undefined }), new Date(), deep, { values: Array.from({ length: 5000 }, () => 1) }]) {
      expect(() => compileSelectionPoc(input)).toThrow(SelectionPocError);
    }
    expect(getter).not.toHaveBeenCalled();
  });
  it('redacts unexpected paths, issue messages and values', () => {
    const parsed = z.unknown().superRefine((_value, ctx) => ctx.addIssue({ code: 'custom', path: ['components', 0, 'SECRET-KEY'], message: 'SECRET-VALUE' })).safeParse(null);
    if (parsed.success) throw new Error('Expected failure');
    const diagnostic = describePocFailure(new SelectionPocError('selection_schema', parsed.error.issues));
    expect(diagnostic.issues[0]).toEqual({ path: ['components', 0, '[redacted]'], code: 'custom', message: 'A value violates the selection contract.' });
    expect(JSON.stringify(diagnostic)).not.toContain('SECRET');
  });
});

describe('existing presentation/TSX contracts and frozen PoC inputs', () => {
  it('keeps accessible label bindings and uses the same specification for presentation and code', () => {
    const output = compileSelectionPoc(selection(leaves, { form: { enabled: true, label: 'Example' } }));
    const before = JSON.stringify(output);
    const presentation = buildPresentation(output);
    const code = generateTsx(output);
    expect(presentation).toMatchObject({ tag: 'form', props: { 'aria-label': 'Example' } });
    for (const node of flatten(output.root).filter(node => 'name' in node.props)) {
      expect(code).toContain(`htmlFor={${JSON.stringify(node.id)}}`);
      expect(code).toContain(`id={${JSON.stringify(node.id)}}`);
    }
    expect(code).toContain('onSubmit={(event) => event.preventDefault()}');
    for (const unsafe of ['eval(', 'new Function', 'fetch(', 'dangerouslySetInnerHTML']) expect(code).not.toContain(unsafe);
    expect(JSON.stringify(output)).toBe(before);
  });
  it('type-checks generated source for every leaf, mixed rows, forms and escaped strings against installed Nova', () => {
    const specimens = [...leaves.map(leaf => selection([leaf])), selection(leaves, { form: { enabled: true, label: 'Example' } }),
      selection([text('A'), { ...field('Café'), besidePrevious: true }, { type: 'button', props: { label: 'Apply', type: 'reset' } }], { form: { enabled: true, label: 'Editor' } }),
      selection([text('Quotes " & \\ newline\n雪\u2028')]),
    ];
    expect(checkGeneratedTsx(specimens.map(item => generateTsx(compileSelectionPoc(item))))).toEqual([]);
  }, 20000);
  it('freezes all twelve approved cases and uses only the three requested feasibility prompts', () => {
    expect(dataset.cases).toHaveLength(12);
    expect(hash(readFileSync(resolve(__dirname, '../evaluation/selection-poc/cases-v1.json'), 'utf8'))).toBe('cd20106e24e0d55fdb6c457551d14a5ce3e301f3256f7d834bc092afe8c8dd7b');
    expect(feasibilityCases.map(item => item.prompt)).toEqual([
      'Create an email input with a label.', 'Responsive login form with remember me.',
      'Create a profile form with first name and last name side by side, email below, and a Save Profile button.',
    ]);
  });
});
