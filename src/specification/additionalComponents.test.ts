import { createElement } from 'react';
import type { MouseEvent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Link } from '@visa/nova-react';
import { linkDestinationSchema } from './componentRegistry';
import { uiSpecificationSchema } from './uiSpecification';
import { buildPresentation } from './presentation';
import { UiSpecificationPreview } from './UiSpecificationPreview';
import { generateTsx } from './generateTsx';

const document = (type: string, props: unknown) => ({ version: '1.0', root: { id: 'example', type, props } });
const parse = (type: string, props: unknown) => uiSpecificationSchema.parse(document(type, props));
const markup = (type: string, props: unknown) => renderToStaticMarkup(createElement(UiSpecificationPreview, { specification: parse(type, props) }));

describe('additional Nova 2.5.4 components', () => {
  it('renders a labeled multiline field with bounded native properties and literal false values', () => {
    const props = { name: 'notes', label: 'Notes', placeholder: 'Add details', rows: 4, maxLength: 300, required: false, disabled: false };
    const specification = parse('textarea', props);
    expect(specification.root.props).toEqual(props);
    const html = markup('textarea', props);
    expect(html).toContain('for="example"'); expect(html).toContain('<textarea');
    expect(html).toContain('id="example"'); expect(html).toContain('name="notes"');
    expect(html).toContain('rows="4"'); expect(html).toContain('maxLength="300"');
    expect(html).not.toContain('disabled=""'); expect(html).not.toContain('required=""');
    expect(generateTsx(specification)).toContain('required={false} disabled={false}');
  });

  it.each([false, true])('renders a natively operable switch initially checked=%s', defaultChecked => {
    const props = { name: 'alerts', label: 'Alerts', defaultChecked, disabled: false };
    const html = markup('switch', props);
    expect(html).toContain('role="switch"'); expect(html).toContain('type="checkbox"');
    expect(html).toContain('class="v-label v-switch-label"'); expect(html).toContain('for="example"');
    expect(html.includes('checked=""')).toBe(defaultChecked);
    expect(html).not.toContain('disabled=""');
    expect(generateTsx(parse('switch', props))).toContain(`defaultChecked={${defaultChecked}}`);
  });

  it.each(['critical', 'neutral', 'stable', 'subtle', 'warning'])('renders a non-interactive %s text badge', badgeType => {
    const html = markup('badge', { content: 'Ready', badgeType });
    expect(html).toContain(`v-badge-${badgeType}`); expect(html).toContain('Ready');
    expect(html).not.toContain('<button'); expect(html).not.toContain('<svg');
  });

  it.each([undefined, 'section', 'decorative'])('preserves divider semantics for %s', dividerType => {
    const html = markup('divider', dividerType ? { dividerType } : {});
    expect(html).toContain('<hr');
    expect(html.includes('aria-hidden="true"')).toBe(dividerType === 'decorative');
  });

  it('retains the destination in code but prevents primary and auxiliary preview navigation', () => {
    const href = 'https://design.visa.com/?topic=ui&mode=demo';
    const specification = parse('link', { label: 'Read documentation', href });
    expect(buildPresentation(specification)).toEqual({ tag: 'Link', props: { id: 'example', href }, children: ['Read documentation'] });
    const element = UiSpecificationPreview({ specification });
    expect(element.type).toBe(Link);
    const props = element.props as { href: string; onClick: (event: MouseEvent) => void; onAuxClick: (event: MouseEvent) => void };
    expect(props.href).toBe(href);
    for (const handler of [props.onClick, props.onAuxClick]) {
      const preventDefault = vi.fn(); handler({ preventDefault } as unknown as MouseEvent);
      expect(preventDefault).toHaveBeenCalledOnce();
    }
    const source = generateTsx(specification);
    expect(source).toContain('href={"https://design.visa.com/?topic=ui\\u0026mode=demo"}');
    expect(source).not.toContain('onClick'); expect(source).not.toContain('onAuxClick');
    expect(markup('link', { label: 'Read documentation', href })).toContain('class="v-link"');
  });

  it.each([
    ['textarea', { name: 'notes', label: 'Notes', rows: 0 }],
    ['textarea', { name: 'notes', label: 'Notes', rows: 21 }],
    ['textarea', { name: 'notes', label: 'Notes', rows: 1.5 }],
    ['textarea', { name: 'notes', label: 'Notes', maxLength: 1001 }],
    ['textarea', { name: 'notes', label: 'Notes', disabled: 'false' }],
    ['switch', { name: 'alerts', label: 'Alerts', defaultChecked: null }],
    ['switch', { name: 'alerts', label: 'Alerts', checked: true }],
    ['badge', { content: 'Ready', badgeVariant: 'icon' }],
    ['badge', { content: 'x'.repeat(201) }],
    ['badge', { content: 'Ready', badgeType: 'success' }],
    ['divider', { dividerType: 'vertical' }],
    ['divider', { label: 'Separator' }],
    ['link', { label: 'Read', href: '/help', target: '_blank' }],
    ['link', { label: '' , href: '/help' }],
  ])('rejects invalid/unsupported %s properties %#', (type, props) => {
    expect(uiSpecificationSchema.safeParse(document(type, props)).success).toBe(false);
  });

  it.each(['textarea', 'switch', 'badge', 'divider', 'link'])('rejects executable properties on %s', type => {
    const props = type === 'textarea' || type === 'switch' ? { name: 'field', label: 'Field' }
      : type === 'badge' ? { content: 'Ready' } : type === 'link' ? { label: 'Help', href: '/help' } : {};
    for (const key of ['onClick', 'onChange', 'style', 'className', 'dangerouslySetInnerHTML', 'tag']) {
      expect(uiSpecificationSchema.safeParse(document(type, { ...props, [key]: 'unsafe' })).success).toBe(false);
    }
  });
});

describe('bounded, non-executable link destinations', () => {
  it.each(['https://design.visa.com/', 'http://localhost:3000/help', '/help?a=1&b=2', './help', '../help', 'help', '#details', '?page=2'])('preserves valid %s unchanged', href => {
    expect(linkDestinationSchema.parse(href)).toBe(href);
  });
  it.each(['', 'javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\nscript:alert(1)', 'data:text/html,unsafe', 'vbscript:unsafe',
    'file:///etc/passwd', 'mailto:user@example.com', '//example.com', '\\example.com', '/\\example.com',
    'https://user:secret@example.com', 'https:example.com', 'https://', ' https://example.com', '/help with spaces',
    '/help\u0000', '/help\u0085', '/<script>', '/{expression}', 'x'.repeat(1001)])('rejects unsafe or unsupported %j', href => {
    expect(linkDestinationSchema.safeParse(href).success).toBe(false);
    expect(uiSpecificationSchema.safeParse(document('link', { label: 'Help', href })).success).toBe(false);
  });
});
