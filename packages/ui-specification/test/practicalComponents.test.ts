import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { uiSpecificationSchema } from '../src/uiSpecification';
import { UiSpecificationPreview } from '../src/UiSpecificationPreview';
import { generateTsx } from '../src/generateTsx';

const input = (type: string, props: unknown) => ({ version: '1.0', root: { id: 'example', type, props } });
const parse = (type: string, props: unknown) => uiSpecificationSchema.parse(input(type, props));
const html = (type: string, props: unknown) => renderToStaticMarkup(createElement(UiSpecificationPreview, { specification: parse(type, props) }));
const choice = { name: 'choice', label: 'Delivery', options: ['Standard', 'Express'], required: false, disabled: false };

describe('practical Nova 2.5.4 families', () => {
  it('renders native select options in order, preserving the default and explicit false flags', () => {
    const props = { ...choice, defaultValue: 'Express' };
    const markup = html('select', props);
    expect(markup).toContain('<select'); expect(markup).toContain('for="example"');
    expect(markup).toContain('<option value="Standard">Standard</option>');
    expect(markup).toContain('<option value="Express" selected="">Express</option>');
    const source = generateTsx(parse('select', props));
    expect(source).toContain('required={false} disabled={false} defaultValue={"Express"}');
    expect(source.split('\n')[0]).not.toContain('option');
  });
  it('uses a native fieldset/legend and labeled, mutually exclusive radio inputs', () => {
    const markup = html('radioGroup', { ...choice, defaultValue: 'Express' });
    expect(markup).toContain('<legend>Delivery</legend>');
    expect(markup.match(/name="choice"/g)).toHaveLength(2);
    expect(markup.match(/type="radio"/g)).toHaveLength(2);
    expect(markup).toContain('for="example--option-0"');
    expect(markup).toContain('for="example--option-1"');
    expect(markup.match(/checked=""/g)).toHaveLength(1);
    expect(generateTsx(parse('radioGroup', { ...choice, defaultValue: 'Express' }))).toContain('defaultChecked={false}');
    expect(html('radioGroup', choice)).not.toContain('checked=""');
  });
  it.each([undefined, { label: 'Explore' }, { label: 'Explore', href: '/release' }])('renders a content card with optional action %#', action => {
    const props = { title: 'Release', description: 'Ready today', ...(action ? { action } : {}) };
    const markup = html('contentCard', props);
    expect(markup).toContain('v-content-card'); expect(markup).toContain('Release'); expect(markup).toContain('Ready today');
    expect(markup.includes('<a ')).toBe(action !== undefined && 'href' in action);
    expect(markup.includes('<button ')).toBe(action !== undefined && !('href' in action));
    if (action && !('href' in action)) expect(markup).toContain('type="button"');
    // Destination validation and preview containment use the existing Link path.
    if (action && 'href' in action) expect(generateTsx(parse('contentCard', props))).toContain('href={"/release"}');
  });
  it.each([false, true])('composes payment fields, includeCardholder=%s, without claiming payment behavior', includeCardholder => {
    const props = { name: 'payment', label: 'Card details', includeCardholder, required: false, disabled: false };
    const markup = html('paymentCard', props);
    expect(markup).toContain('<legend>Card details</legend>');
    expect(markup.match(/<input /g)).toHaveLength(includeCardholder ? 4 : 3);
    expect(markup).toContain('name="payment[number]"'); expect(markup).toContain('name="payment[expiry]"');
    expect(markup).toMatch(/<input[^>]*type="password"[^>]*name="payment\[security-code\]"/);
    expect(markup).toContain('for="example--number"');
    expect(markup.match(/autoComplete="off"/g)).toHaveLength(includeCardholder ? 4 : 3);
    expect(markup).toContain('No card validation or payment processing.');
    expect(markup).not.toContain('required=""'); expect(markup).not.toContain('disabled=""');
    const source = generateTsx(parse('paymentCard', props));
    expect(source).toContain('required={false} disabled={false}');
    expect(source.split('\n')[0]).not.toMatch(/fieldset|legend/);
  });
  it('preserves required and disabled across every payment field', () => {
    const markup = html('paymentCard', { name: 'payment', label: 'Card', includeCardholder: true, required: true, disabled: true });
    expect(markup.match(/required=""/g)).toHaveLength(4);
    expect(markup.match(/disabled=""/g)).toHaveLength(5); // fieldset plus four inputs
  });
  it.each([0, 40, 100])('renders determinate progress at %s with an accessible label', value => {
    const props = { label: 'Upload', mode: 'determinate', value, paused: false };
    const markup = html('progress', props);
    expect(markup).toContain('for="example"'); expect(markup).toContain('<progress');
    expect(markup).toContain('max="100"'); expect(markup).toContain(`value="${value}"`);
    expect(generateTsx(parse('progress', props))).toContain('paused={false}');
  });
  it('represents indeterminate progress by omitting value, with no invented timer', () => {
    const props = { label: 'Loading', mode: 'indeterminate', paused: true };
    expect(html('progress', props)).not.toContain('value=');
    const source = generateTsx(parse('progress', props));
    expect(source).not.toContain('value='); expect(source).toContain('paused={true}');
    expect(source).not.toMatch(/setInterval|setTimeout|useEffect/);
  });
  it('keeps composite IDs/names disjoint from ordinary sibling fields', () => {
    const specification = uiSpecificationSchema.parse({ version: '1.0', root: { id: 'root', type: 'verticalLayout', props: {}, children: [
      { id: 'example', type: 'paymentCard', props: { name: 'card', label: 'Card' } },
      { id: 'example-number', type: 'textInput', props: { name: 'card-number', label: 'Reference' } },
    ] } });
    const markup = renderToStaticMarkup(createElement(UiSpecificationPreview, { specification }));
    const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(markup).toContain('name="card[number]"'); expect(markup).toContain('name="card-number"');
  });
  it.each([
    ['select', { ...choice, options: [] }], ['select', { ...choice, options: ['A', 'A'] }],
    ['select', { ...choice, options: Array.from({ length: 21 }, (_, i) => String(i)) }],
    ['select', { ...choice, options: ['<script>'] }], ['select', { ...choice, defaultValue: 'Missing' }],
    ['radioGroup', { ...choice, options: ['A'] }], ['radioGroup', { ...choice, defaultValue: 'Missing' }],
    ['contentCard', { title: 'Card', description: '' }],
    ['contentCard', { title: 'Card', description: 'Text', action: { label: 'Go', href: 'javascript:alert(1)' } }],
    ['contentCard', { title: 'Card', description: 'Text', action: { label: 'Go', onClick: 'code' } }],
    ['paymentCard', { name: 'card', label: 'Card', includeCardholder: null }],
    ['paymentCard', { name: 'card', label: 'Card', cardNumber: 'sensitive' }],
    ['progress', { label: 'Upload', mode: 'determinate' }],
    ['progress', { label: 'Upload', mode: 'determinate', value: -1 }],
    ['progress', { label: 'Upload', mode: 'determinate', value: 101 }],
    ['progress', { label: 'Upload', mode: 'indeterminate', value: 0 }],
    ['progress', { label: 'Upload', mode: 'indeterminate', onChange: 'code' }],
  ])('rejects invalid or unsafe %s properties %#', (type, props) => {
    expect(uiSpecificationSchema.safeParse(input(type, props)).success).toBe(false);
  });
});
