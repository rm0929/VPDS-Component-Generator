import { Children, createElement, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Footer, InputControl, Badge, Button, Checkbox, ContentCard, ContentCardBody, ContentCardTitle, ProgressLinear, ProgressLabel, Radio, Select, Divider, Input, InputContainer, Label, Link, Switch, SwitchLabel, Textarea, Typography, Utility } from '@visa/nova-react';
import { VisaCardGenericLow } from '@visa/nova-icons-react';
import { DialogExample } from './interactions/DialogExample';
import { FlagExample } from './interactions/FlagExample';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import registrationJson from './fixtures/registration-form.json?raw';
import { COMPONENT_TYPES } from './componentRegistry';
import type { ComponentType, UiNode } from './componentRegistry';
import { uiSpecificationSchema } from './uiSpecification';
import type { UiSpecification } from './uiSpecification';
import { UiSpecificationPreview } from './UiSpecificationPreview';
import { generateTsx } from './generateTsx';

const examples = {
  textInput: { id: 'name', type: 'textInput', props: { name: 'full-name', label: 'Name', placeholder: 'Your name', required: true, disabled: false, maxLength: 100 } },
  emailInput: { id: 'email', type: 'emailInput', props: { name: 'email-address', label: 'Email', required: false, disabled: true } },
  passwordInput: { id: 'password', type: 'passwordInput', props: { name: 'new-password', label: 'Password', required: true, maxLength: 64 } },
  checkbox: { id: 'terms', type: 'checkbox', props: { name: 'accept-terms', label: 'Accept terms', required: true, disabled: true } },
  button: { id: 'continue', type: 'button', props: { label: 'Continue', type: 'button', disabled: false } },
  text: { id: 'description', type: 'text', props: { content: 'Description' } },
  heading: { id: 'title', type: 'heading', props: { content: 'Registration', level: 2 } },
  textarea: { id: 'notes', type: 'textarea', props: { name: 'notes', label: 'Notes', rows: 4, maxLength: 300, required: false, disabled: false } },
  switch: { id: 'alerts', type: 'switch', props: { name: 'alerts', label: 'Alerts', defaultChecked: false, disabled: false } },
  badge: { id: 'status', type: 'badge', props: { content: 'Ready', badgeType: 'stable' } },
  divider: { id: 'separator', type: 'divider', props: { dividerType: 'decorative' } },
  link: { id: 'help', type: 'link', props: { label: 'Help', href: 'https://design.visa.com/?a=1&b=2' } },
  select: { id: 'country', type: 'select', props: { name: 'country', label: 'Country', options: ['Canada', 'Japan'], defaultValue: 'Japan', required: false, disabled: false } },
  radioGroup: { id: 'delivery', type: 'radioGroup', props: { name: 'delivery', label: 'Delivery', options: ['Standard', 'Express'], defaultValue: 'Express', required: false, disabled: false } },
  contentCard: { id: 'summary', type: 'contentCard', props: { title: 'Release', description: 'Ready today', action: { label: 'Explore', href: '/release' } } },
  paymentCard: { id: 'payment', type: 'paymentCard', props: { name: 'payment', label: 'Card details', includeCardholder: true, required: false, disabled: false } },
  progress: { id: 'upload', type: 'progress', props: { label: 'Upload', mode: 'determinate', value: 0, paused: false } },
  dialog: { id: 'review', type: 'dialog', props: { title: 'Review update', content: 'Review the information.', triggerLabel: 'Review', closeLabel: 'Cancel' } },
  flag: { id: 'feedback', type: 'flag', props: { content: 'Updated', variant: 'success', dismissible: true } },
  footer: { id: 'bottom', type: 'footer', props: { text: 'Example service', links: [{ label: 'Terms', href: '/terms' }] } },
  verticalLayout: { id: 'column', type: 'verticalLayout', props: { gap: 'large' }, children: [{ id: 'column-text', type: 'text', props: { content: 'Column' } }] },
  horizontalLayout: { id: 'row', type: 'horizontalLayout', props: { gap: 'small' }, children: [{ id: 'row-text', type: 'text', props: { content: 'Row' } }] },
  form: { id: 'form', type: 'form', props: { label: 'Registration form' }, children: [{ id: 'submit', type: 'button', props: { label: 'Register', type: 'submit' } }] },
} satisfies Record<ComponentType, UiNode>;

const spec = (root: UiNode) => uiSpecificationSchema.parse({ version: '1.0', root });
const registration = uiSpecificationSchema.parse(JSON.parse(registrationJson));
const preview = (specification: UiSpecification) => UiSpecificationPreview({ specification });
const markup = (specification: UiSpecification) => renderToStaticMarkup(createElement(UiSpecificationPreview, { specification }));

type ComparableElement = { tag: string; props: Record<string, unknown>; children: (ComparableElement | string)[] };
const novaNames = new Map<unknown, string>([
  [DialogExample, 'DialogExample'], [FlagExample, 'FlagExample'], [Footer, 'Footer'],
  [InputControl, 'InputControl'], [VisaCardGenericLow, 'VisaCardGenericLow'],
  ['nav', 'nav'], ['ul', 'ul'], ['li', 'li'], ['details', 'details'], ['summary', 'summary'],
  [Button, 'Button'], [Checkbox, 'Checkbox'], [Input, 'Input'], [InputContainer, 'InputContainer'],
  [Badge, 'Badge'], [Divider, 'Divider'], [Link, 'Link'], [Switch, 'Switch'], [SwitchLabel, 'SwitchLabel'], [Textarea, 'Textarea'],
  [Select, 'Select'], [Radio, 'Radio'], [ContentCard, 'ContentCard'], [ContentCardBody, 'ContentCardBody'],
  [ContentCardTitle, 'ContentCardTitle'], [ProgressLinear, 'ProgressLinear'], [ProgressLabel, 'ProgressLabel'],
  ['option', 'option'], ['fieldset', 'fieldset'], ['legend', 'legend'],
  [Label, 'Label'], [Typography, 'Typography'], [Utility, 'Utility'], ['form', 'form'],
]);

// Inspect actual renderer output without mocking Nova or executing generated code.
function reactTree(element: ReactElement): ComparableElement {
  const props = element.props as Record<string, unknown>;
  const tag = novaNames.get(element.type);
  if (!tag) throw new Error('Unexpected renderer component');
  return {
    tag,
    props: Object.fromEntries(Object.entries(props)
      .filter(([key, value]) => key !== 'children' && value !== undefined
        && !(tag === 'Link' && (key === 'onClick' || key === 'onAuxClick')))
      .map(([key, value]) => [key, key === 'onSubmit' ? 'prevent-submit' : value])),
    children: Children.toArray(props.children as ReactNode).map(child => {
      if (typeof child === 'string') return child;
      if (isValidElement(child)) return reactTree(child);
      throw new Error('Unexpected renderer child');
    }),
  };
}

function literal(expression: ts.Expression): string | number | boolean {
  if (ts.isStringLiteral(expression)) return expression.text;
  if (ts.isNumericLiteral(expression)) return Number(expression.text);
  if (expression.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (expression.kind === ts.SyntaxKind.FalseKeyword) return false;
  throw new Error(`Unexpected nonliteral expression: ${expression.getText()}`);
}

// Read the emitted TSX AST as data. No transpiled source is executed.
function jsxTree(node: ts.JsxElement | ts.JsxSelfClosingElement): ComparableElement {
  const opening = ts.isJsxElement(node) ? node.openingElement : node;
  const props: Record<string, unknown> = {};
  for (const attribute of opening.attributes.properties) {
    if (!ts.isJsxAttribute(attribute) || !attribute.initializer || !ts.isJsxExpression(attribute.initializer) || !attribute.initializer.expression) {
      throw new Error('Expected explicit expression attributes without spreads');
    }
    const name = attribute.name.getText();
    const expression = attribute.initializer.expression;
    if (name === 'onSubmit') {
      expect(expression.getText()).toBe('(event) => event.preventDefault()');
      props[name] = 'prevent-submit';
    } else props[name] = literal(expression);
  }
  const children: (ComparableElement | string)[] = [];
  if (ts.isJsxElement(node)) {
    for (const child of node.children) {
      if (ts.isJsxText(child) && !child.text.trim()) continue;
      if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) children.push(jsxTree(child));
      else if (ts.isJsxExpression(child) && child.expression) {
        const value = literal(child.expression);
        if (typeof value !== 'string') throw new Error('Expected literal text');
        children.push(value);
      } else throw new Error('Unexpected JSX content');
    }
  }
  return { tag: opening.tagName.getText(), props, children };
}

function generatedTree(source: string): ComparableElement {
  const file = ts.createSourceFile('GeneratedUI.tsx', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  const declaration = file.statements.find(ts.isFunctionDeclaration);
  const statement = declaration?.body?.statements.find(ts.isReturnStatement);
  const expression = statement?.expression;
  if (!expression || !ts.isParenthesizedExpression(expression)) throw new Error('Expected component return');
  const jsx = expression.expression;
  if (!ts.isJsxElement(jsx) && !ts.isJsxSelfClosingElement(jsx)) throw new Error('Expected JSX');
  return jsxTree(jsx);
}

function allElements(element: ComparableElement): ComparableElement[] {
  return [element, ...element.children.flatMap(child => typeof child === 'string' ? [] : allElements(child))];
}

describe('trusted preview and deterministic TSX generation', () => {
  it.each(COMPONENT_TYPES)('renders %s with identical generated structure and properties', type => {
    const specification = spec(examples[type]);
    const tree = reactTree(preview(specification));
    expect(generatedTree(generateTsx(specification))).toEqual(tree);
    expect(markup(specification)).toContain(`id="${examples[type].id}"`);
  });

  it.each([
    ['textInput', ['Input', 'InputContainer', 'Label', 'Utility']],
    ['emailInput', ['Input', 'InputContainer', 'Label', 'Utility']],
    ['passwordInput', ['Input', 'InputContainer', 'Label', 'Utility']],
    ['checkbox', ['Checkbox', 'Label', 'Utility']],
    ['button', ['Button']],
    ['text', ['Typography']],
    ['heading', ['Typography']],
    ['verticalLayout', ['Typography', 'Utility']],
    ['horizontalLayout', ['Typography', 'Utility']],
    ['form', ['Button']],
  ] as const)('emits precisely the required static Nova imports for %s', (type, imports) => {
    const source = generateTsx(spec(examples[type]));
    expect(source.split('\n')[0]).toBe(`import { ${imports.join(', ')} } from '@visa/nova-react';`);
    expect(source.match(/import /g)).toHaveLength(1);
    expect(source).toContain('export default function GeneratedUI()');
    expect(source).not.toContain('import(');
  });

  it.each(['textInput', 'emailInput', 'passwordInput'] as const)(
    'preserves accessible label, ID, name, native type, and input attributes for %s', type => {
      const html = markup(spec(examples[type]));
      const node = examples[type];
      expect(html).toContain(`<label class="v-label" for="${node.id}">${node.props.label}</label>`);
      expect(html).toMatch(new RegExp(`<input[^>]*id="${node.id}"[^>]*name="${node.props.name}"`));
      expect(html).toContain(`type="${type === 'textInput' ? 'text' : type === 'emailInput' ? 'email' : 'password'}"`);
      expect(html.includes('required=""')).toBe(node.props.required);
      expect(html.includes('disabled=""')).toBe('disabled' in node.props && node.props.disabled);
    },
  );

  it('preserves placeholder and maxLength, and does not invent optional properties', () => {
    const html = markup(spec(examples.textInput));
    expect(html).toContain('placeholder="Your name"');
    expect(html).toContain('maxLength="100"');
    const simple = spec({ id: 'simple', type: 'textInput', props: { name: 'simple', label: 'Simple' } });
    const source = generateTsx(simple);
    for (const attribute of ['placeholder=', 'maxLength=', 'disabled=', 'required=']) expect(source).not.toContain(attribute);
    expect(source).not.toContain('undefined');
  });

  it('preserves checkbox accessible labeling and native required/disabled flags', () => {
    const html = markup(spec(examples.checkbox));
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('id="terms"');
    expect(html).toContain('name="accept-terms"');
    expect(html).toContain('for="terms">Accept terms</label>');
    expect(html).toContain('required=""');
    expect(html).toContain('disabled=""');
  });

  it.each([1, 2, 3, 4] as const)('pairs semantic h%s with the matching Nova heading variant', level => {
    const specification = spec({ ...examples.heading, props: { content: 'Title', level } });
    const html = markup(specification);
    expect(html).toContain(`<h${level} class="v-typography-headline-${level}" id="title">Title</h${level}>`);
    expect(generatedTree(generateTsx(specification))).toEqual(reactTree(preview(specification)));
  });

  it.each([
    { gap: undefined, pixels: 16 }, { gap: 'none', pixels: 0 },
    { gap: 'small', pixels: 8 }, { gap: 'medium', pixels: 16 }, { gap: 'large', pixels: 24 },
  ] as const)('uses gap $gap → $pixels consistently in both layout directions', ({ gap, pixels }) => {
    for (const type of ['verticalLayout', 'horizontalLayout'] as const) {
      const specification = spec({ ...examples[type], props: gap ? { gap } : {} });
      const html = markup(specification);
      expect(html).toContain(`v-gap-${pixels}`);
      expect(html).toContain(type === 'verticalLayout' ? 'v-flex-col' : 'v-flex-row');
      expect(generateTsx(specification)).toContain(`vGap={${pixels}}`);
      expect(generatedTree(generateTsx(specification))).toEqual(reactTree(preview(specification)));
    }
  });

  it('renders the registration fixture as an accessible form and generates the same complete tree', () => {
    const html = markup(registration);
    expect(html).toContain('<form id="registration-form" aria-label="Create an account">');
    for (const id of ['name', 'email', 'password', 'confirm-password', 'terms']) {
      expect(html).toContain(`id="${id}"`);
      expect(html).toContain(`name="${id}"`);
      expect(html).toContain(`for="${id}"`);
    }
    expect(html.match(/type="password"/g)).toHaveLength(2);
    expect(html).toContain('type="submit"');
    expect(generatedTree(generateTsx(registration))).toEqual(reactTree(preview(registration)));
    expect(generateTsx(registration).split('\n')[0]).toBe("import { Button, Checkbox, Input, InputContainer, Label, Typography, Utility } from '@visa/nova-react';");
  });

  it('supports nested horizontal/vertical containers within a form in child order', () => {
    const specification = spec({ ...examples.form, children: [{
      ...examples.verticalLayout, children: [{
        ...examples.horizontalLayout, children: [examples.textInput, examples.emailInput],
      }, examples.checkbox, examples.button],
    }] });
    const html = markup(specification);
    expect(html.indexOf('id="name"')).toBeLessThan(html.indexOf('id="email"'));
    expect(html.indexOf('id="email"')).toBeLessThan(html.indexOf('id="terms"'));
    expect(generatedTree(generateTsx(specification))).toEqual(reactTree(preview(specification)));
  });

  it('prevents default submission for every form without reading fields or using a supplied handler', () => {
    const tree = preview(registration);
    const props = tree.props as { onSubmit: (event: { preventDefault: () => void }) => void };
    let prevented = false;
    props.onSubmit({ preventDefault: () => { prevented = true; } });
    expect(prevented).toBe(true);
    const source = generateTsx(registration);
    expect(source).toContain('onSubmit={(event) => event.preventDefault()}');
    for (const unsafe of ['fetch(', 'action=', 'FormData', 'localStorage', 'eval(', 'new Function', 'dangerouslySetInnerHTML']) {
      expect(source).not.toContain(unsafe);
    }
    expect(markup(registration)).not.toContain('action=');
  });

  it.each(['submit', 'reset', 'button'] as const)('preserves button type %s and disabled flags', type => {
    const specification = spec({ ...examples.form, children: [{ ...examples.button, props: { label: 'Action', type, disabled: true } }] });
    expect(markup(specification)).toContain(`type="${type}"`);
    expect(markup(specification)).toContain('disabled=""');
    expect(generatedTree(generateTsx(specification))).toEqual(reactTree(preview(specification)));
  });

  const specialText = '  O\'Reilly says "hello" & goodbye \\ path\nnext\r\ntab\t雪\u2028line\u2029paragraph\u0000';
  const escapedSpec = spec({ ...examples.form, props: { label: specialText }, children: [
    { ...examples.textInput, props: { name: 'full-name', label: specialText, placeholder: specialText } },
    { ...examples.checkbox, props: { name: 'accept-terms', label: specialText } },
    { ...examples.button, props: { label: specialText, type: 'button' } },
    { ...examples.text, props: { content: specialText } },
    { ...examples.heading, props: { content: specialText, level: 2 } },
  ] });

  it('escapes quotes, ampersands, backslashes, whitespace, controls, Unicode, and JS line separators as literal strings', () => {
    const source = generateTsx(escapedSpec);
    expect(source).toContain('\\"hello\\"');
    expect(source).toContain('\\u0026');
    expect(source).toContain('\\\\ path');
    expect(source).toContain('\\n');
    expect(source).toContain('\\r');
    expect(source).toContain('\\t');
    expect(source).toContain('\\u2028');
    expect(source).toContain('\\u2029');
    expect(source).toContain('\\u0000');
    expect(generatedTree(source)).toEqual(reactTree(preview(escapedSpec)));
    const html = markup(escapedSpec);
    expect(html).toContain('O&#x27;Reilly says &quot;hello&quot; &amp; goodbye');
  });

  it('treats code-looking allowed prose as text without introducing executable expressions', () => {
    const specification = spec({ ...examples.text, props: { content: 'alert(1); document.cookie' } });
    expect(markup(specification)).toContain('alert(1); document.cookie</p>');
    expect(generateTsx(specification)).toContain('{"alert(1); document.cookie"}');
    expect(generatedTree(generateTsx(specification))).toEqual(reactTree(preview(specification)));
  });

  it('is deterministic, independent of object key order, and does not mutate its input', () => {
    const before = JSON.stringify(registration);
    expect(generateTsx(registration)).toBe(generateTsx(registration));
    expect(markup(registration)).toBe(markup(registration));
    expect(JSON.stringify(registration)).toBe(before);
    const reordered = spec({ type: 'textInput', props: { disabled: false, label: 'Name', maxLength: 100, required: true, placeholder: 'Your name', name: 'full-name' }, id: 'name' });
    expect(generateTsx(reordered)).toBe(generateTsx(spec(examples.textInput)));
  });

  it.each([
    { version: '2.0', root: examples.text },
    { version: '1.0', root: { id: 'script', type: 'script', props: {} } },
    { version: '1.0', root: { ...examples.textInput, props: { ...examples.textInput.props, onChange: 'alert(1)' } } },
    { version: '1.0', root: { ...examples.text, props: { content: '<script>alert(1)</script>' } } },
    { version: '1.0', root: { ...examples.text, style: { color: 'red' } } },
    { version: '1.0', root: { ...examples.form, children: [examples.form] } },
  ])('rejects forged invalid or unsupported specifications at both consumer boundaries %#', invalid => {
    const forged = invalid as unknown as UiSpecification;
    expect(() => preview(forged)).toThrow();
    expect(() => generateTsx(forged)).toThrow();
  });

  it('revalidates mutated formerly valid data', () => {
    const mutable = spec(examples.text);
    Object.assign(mutable.root.props, { onClick: () => { throw new Error('must not run'); } });
    expect(() => preview(mutable)).toThrow();
    expect(() => generateTsx(mutable)).toThrow();
  });

  it('all generated components syntactically and semantically type-check against installed React/Nova APIs', () => {
    const cases = [registration, escapedSpec, ...COMPONENT_TYPES.map(type => spec(examples[type]))];
    const virtualFiles = new Map(cases.map((specification, index) => [
      `${ts.sys.getCurrentDirectory()}/src/specification/__generated_check_${index}.tsx`, generateTsx(specification),
    ]));
    const options: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX,
      strict: true, noUnusedLocals: true, noUnusedParameters: true,
      skipLibCheck: true, noEmit: true, types: ['react', 'react-dom'],
    };
    const host = ts.createCompilerHost(options);
    const readFile = host.readFile.bind(host);
    const fileExists = host.fileExists.bind(host);
    const getSourceFile = host.getSourceFile.bind(host);
    host.readFile = filename => virtualFiles.get(filename) ?? readFile(filename);
    host.fileExists = filename => virtualFiles.has(filename) || fileExists(filename);
    host.getSourceFile = (filename, languageVersion, onError, shouldCreateNewSourceFile) => {
      const source = virtualFiles.get(filename);
      return source === undefined ? getSourceFile(filename, languageVersion, onError, shouldCreateNewSourceFile)
        : ts.createSourceFile(filename, source, languageVersion, true, ts.ScriptKind.TSX);
    };
    const program = ts.createProgram([...virtualFiles.keys()], options, host);
    const diagnostics = ts.getPreEmitDiagnostics(program).map(diagnostic =>
      `${diagnostic.file?.fileName ?? ''}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
    expect(diagnostics).toEqual([]);
    // Real Nova components were used throughout, with no mocks or source evaluation.
    expect(allElements(reactTree(preview(registration))).filter(node => node.tag === 'Input')).toHaveLength(4);
  }, 20000);
});
