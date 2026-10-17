import { describe, expect, expectTypeOf, it } from 'vitest';
import registrationJson from './fixtures/registration-form.json?raw';
import { componentRegistry, COMPONENT_TYPES, SPEC_LIMITS } from './componentRegistry';
import type { ComponentProps, ComponentType, UiNode } from './componentRegistry';
import { uiSpecificationSchema } from './uiSpecification';
import type { UiSpecification } from './uiSpecification';

const leaf = (id = 'content'): UiNode => ({ id, type: 'text', props: { content: 'Hello' } });
const document = (root: unknown) => ({ version: '1.0', root });
const fixture = () => JSON.parse(registrationJson) as unknown;
const examples = {
  textInput: { id: 'name', type: 'textInput', props: { name: 'name', label: 'Name' } },
  emailInput: { id: 'email', type: 'emailInput', props: { name: 'email', label: 'Email', required: true } },
  passwordInput: { id: 'password', type: 'passwordInput', props: { name: 'password', label: 'Password', maxLength: 200 } },
  checkbox: { id: 'terms', type: 'checkbox', props: { name: 'terms', label: 'Accept terms', disabled: false } },
  button: { id: 'action', type: 'button', props: { label: 'Continue', type: 'button' } },
  text: leaf(),
  heading: { id: 'title', type: 'heading', props: { content: 'Welcome', level: 1 } },
  verticalLayout: { id: 'column', type: 'verticalLayout', props: { gap: 'large' }, children: [leaf()] },
  horizontalLayout: { id: 'row', type: 'horizontalLayout', props: {}, children: [leaf()] },
  form: { id: 'form', type: 'form', props: { label: 'Registration' }, children: [leaf()] },
} satisfies Record<ComponentType, UiNode>;

function nested(depth: number): UiNode {
  let root = leaf();
  for (let level = 1; level < depth; level++) {
    root = { id: `layout-${level}`, type: 'verticalLayout', props: {}, children: [root] };
  }
  return root;
}

describe('UI specification v1', () => {
  it('validates and round-trips the handcrafted registration JSON without transformation', () => {
    const input = fixture();
    const spec = uiSpecificationSchema.parse(input);
    expect(spec).toEqual(input);
    expect(uiSpecificationSchema.parse(JSON.parse(JSON.stringify(spec)))).toEqual(spec);
    expect(spec.root.type).toBe('form');
    if (spec.root.type === 'form' && spec.root.children[0].type === 'verticalLayout') {
      expect(spec.root.children[0].children.map(node => node.id)).toEqual([
        'registration-title', 'name', 'email', 'password', 'confirm-password', 'terms', 'submit',
      ]);
    }
  });

  it.each(COMPONENT_TYPES)('accepts the registered %s building block', type => {
    expect(uiSpecificationSchema.safeParse(document(examples[type])).success).toBe(true);
  });

  it('preserves discriminated TypeScript types inferred from property schemas', () => {
    expectTypeOf<ComponentProps<'heading'>['level']>().toEqualTypeOf<1 | 2 | 3 | 4>();
    const spec: UiSpecification = uiSpecificationSchema.parse(fixture());
    if (spec.root.type === 'emailInput') {
      expectTypeOf(spec.root.props).toEqualTypeOf<ComponentProps<'emailInput'>>();
      // @ts-expect-error Email inputs cannot carry text content properties.
      void spec.root.props.content;
    }
    // @ts-expect-error Leaf nodes cannot carry child components.
    const invalidLeaf: UiNode = { id: 'text', type: 'text', props: { content: 'Text' }, children: [] };
    void invalidLeaf;
  });

  it.each([undefined, null, [], {}, { root: leaf() }, { version: 1, root: leaf() }, { version: '2.0', root: leaf() }])(
    'rejects an invalid document envelope %#', input => {
      expect(uiSpecificationSchema.safeParse(input).success).toBe(false);
    },
  );

  it.each(['script', 'iframe', 'LoginForm', 'Input', 'unknown', '__proto__', 'constructor'])(
    'rejects unsupported type %s', type => {
      expect(uiSpecificationSchema.safeParse(document({ id: 'node', type, props: {} })).success).toBe(false);
    },
  );

  it.each(['', 'Name', '1name', 'name space', 'name_value', '-name', 'name-', 'a--b', 'x'.repeat(65), '${name}'])(
    'rejects invalid component identifiers %j', id => {
      expect(uiSpecificationSchema.safeParse(document({ ...leaf(), id })).success).toBe(false);
    },
  );

  it.each(['a', 'name-2', 'a'.repeat(64)])('accepts identifier boundary %s', id => {
    expect(uiSpecificationSchema.safeParse(document({ ...leaf(), id })).success).toBe(true);
  });

  it.each([
    { name: 'Invalid name', label: 'Name' },
    { name: 'name' },
    { name: 'name', label: '' },
    { name: 'name', label: '   ' },
    { name: 'name', label: 'a'.repeat(201) },
    { name: 'name', label: 'Name', required: 'true' },
    { name: 'name', label: 'Name', maxLength: 0 },
    { name: 'name', label: 'Name', maxLength: 1001 },
    { name: 'name', label: 'Name', maxLength: 1.5 },
    { name: 'name', label: 'Name', type: 'file' },
  ])('rejects invalid input properties %# without coercion', props => {
    expect(uiSpecificationSchema.safeParse(document({ id: 'input', type: 'textInput', props })).success).toBe(false);
  });

  it.each(['onClick', 'onChange', 'onSubmit', 'style', 'className', 'dangerouslySetInnerHTML', 'jsx', 'expression', 'tag', 'href', 'src', 'action'])(
    'rejects arbitrary %s at both node and property levels', key => {
      expect(uiSpecificationSchema.safeParse(document({ ...leaf(), [key]: 'alert(1)' })).success).toBe(false);
      expect(uiSpecificationSchema.safeParse(document({ ...leaf(), props: { content: 'Hello', [key]: 'alert(1)' } })).success).toBe(false);
    },
  );

  it('rejects unknown envelope keys and prototype-related JSON keys', () => {
    expect(uiSpecificationSchema.safeParse({ ...document(leaf()), extra: true }).success).toBe(false);
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      const props = JSON.parse(`{"content":"Text","${key}":{}}`) as unknown;
      expect(uiSpecificationSchema.safeParse(document({ ...leaf(), props })).success).toBe(false);
    }
  });

  it.each(['<script>alert(1)</script>', '<Button />', '{user.name}', '${alert(1)}', '() => alert(1)', '`template`'])(
    'rejects markup/expression delimiters in literal text %j', content => {
      expect(uiSpecificationSchema.safeParse(document({ ...leaf(), props: { content } })).success).toBe(false);
    },
  );

  it('accepts Unicode and punctuation as literal content', () => {
    expect(uiSpecificationSchema.safeParse(document({ ...leaf(), props: { content: 'こんにちは — Register & continue.' } })).success).toBe(true);
  });

  it.each([
    { ...examples.heading, props: { content: 'Title', level: 5 } },
    { ...examples.heading, props: { content: 'Title', level: '2' } },
    { ...examples.button, props: { label: 'Go', type: 'execute' } },
    { ...examples.checkbox, props: { name: 'terms', label: 'Accept', checked: 'expression' } },
    { ...examples.verticalLayout, props: { gap: 16 } },
    { ...examples.text, props: { content: 'a'.repeat(1001) } },
  ])('rejects unsupported property values %#', root => {
    expect(uiSpecificationSchema.safeParse(document(root)).success).toBe(false);
  });

  it('accepts literal text and numeric boundaries', () => {
    expect(uiSpecificationSchema.safeParse(document({ ...leaf(), props: { content: 'a'.repeat(1000) } })).success).toBe(true);
    for (const maxLength of [1, 1000]) {
      expect(uiSpecificationSchema.safeParse(document({ ...examples.textInput, props: { ...examples.textInput.props, maxLength } })).success).toBe(true);
    }
  });

  it('rejects absent properties and children, empty containers, and children on leaves', () => {
    for (const root of [
      { id: 'node', type: 'text' },
      { id: 'node', type: 'form', props: { label: 'Form' } },
      { ...examples.form, children: [] },
      { ...examples.text, children: [] },
      { ...examples.text, children: [leaf('child')] },
    ]) expect(uiSpecificationSchema.safeParse(document(root)).success).toBe(false);
  });

  it.each(COMPONENT_TYPES.flatMap(parent => COMPONENT_TYPES.map(child => ({ parent, child }))))(
    'enforces registry relationship $parent → $child', ({ parent, child }) => {
      const childNode = structuredClone(examples[child]);
      childNode.id = 'child';
      if ('children' in childNode) childNode.children = [leaf('descendant')];
      const root = { ...examples[parent], id: 'parent', children: [childNode] };
      const allowed: readonly ComponentType[] = componentRegistry[parent].allowedChildren;
      expect(uiSpecificationSchema.safeParse(document(root)).success).toBe(allowed.includes(child));
    },
  );

  it('rejects forms nested indirectly through layouts', () => {
    const root = { ...examples.form, children: [{ ...examples.verticalLayout, children: [{ ...examples.form, id: 'nested-form' }] }] };
    expect(uiSpecificationSchema.safeParse(document(root)).success).toBe(false);
  });

  it.each(['submit', 'reset'])('requires a form ancestor for %s buttons', type => {
    const button = { ...examples.button, props: { label: 'Go', type } };
    expect(uiSpecificationSchema.safeParse(document(button)).success).toBe(false);
    expect(uiSpecificationSchema.safeParse(document({ ...examples.verticalLayout, children: [button] })).success).toBe(false);
    expect(uiSpecificationSchema.safeParse(document({ ...examples.form, children: [{ ...examples.verticalLayout, children: [button] }] })).success).toBe(true);
  });

  it('rejects duplicate IDs and field names with useful issue paths', () => {
    const result = uiSpecificationSchema.safeParse(document({ ...examples.form, children: [examples.textInput, structuredClone(examples.textInput)] }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map(issue => issue.path)).toEqual([
      ['root', 'children', 1, 'id'], ['root', 'children', 1, 'props', 'name'],
    ]);
  });

  it('accepts exactly six node levels and rejects seven or extremely deep trees without a stack overflow', () => {
    expect(uiSpecificationSchema.safeParse(document(nested(SPEC_LIMITS.maxDepth))).success).toBe(true);
    expect(uiSpecificationSchema.safeParse(document(nested(SPEC_LIMITS.maxDepth + 1))).success).toBe(false);
    expect(uiSpecificationSchema.safeParse(document(nested(10000))).success).toBe(false);
  });

  it('counts all nodes including root: accepts 100 and rejects 101', () => {
    const root = { ...examples.verticalLayout, children: Array.from({ length: 99 }, (_, i) => leaf(`text-${i}`)) };
    expect(uiSpecificationSchema.safeParse(document(root)).success).toBe(true);
    root.children.push(leaf('one-too-many'));
    const result = uiSpecificationSchema.safeParse(document(root));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toContain('Maximum 100 components');
  });

  it('enforces total counts across branches, not just immediate children', () => {
    const root = { ...examples.horizontalLayout, children: Array.from({ length: 10 }, (_, i) => ({
      id: `layout-${i}`, type: 'verticalLayout', props: {}, children: Array.from({ length: 10 }, (_, j) => leaf(`text-${i}-${j}`)),
    })) };
    expect(uiSpecificationSchema.safeParse(document(root)).success).toBe(false);
  });

  it.each([undefined, () => 'code', Symbol('code'), 1n, NaN, Infinity, new Date(), new Map()])(
    'rejects non-JSON values %#', content => {
      expect(uiSpecificationSchema.safeParse(document({ ...leaf(), props: { content } })).success).toBe(false);
    },
  );

  it('rejects cycles, shared references, accessors, and sparse arrays', () => {
    const cycle: { children?: unknown[] } = {};
    cycle.children = [cycle];
    expect(uiSpecificationSchema.safeParse(document(cycle)).success).toBe(false);
    const shared = leaf();
    expect(uiSpecificationSchema.safeParse(document({ ...examples.form, children: [shared, shared] })).success).toBe(false);
    const getter = Object.defineProperty({}, 'version', { enumerable: true, get() { throw new Error('must not execute'); } });
    expect(uiSpecificationSchema.safeParse(getter).success).toBe(false);
    expect(uiSpecificationSchema.safeParse(document({ ...examples.form, children: new Array(2) })).success).toBe(false);
  });

  it('rejects oversized malformed data before schema traversal', () => {
    expect(uiSpecificationSchema.safeParse({ junk: Array.from({ length: 5000 }, () => 0) }).success).toBe(false);
  });
});
