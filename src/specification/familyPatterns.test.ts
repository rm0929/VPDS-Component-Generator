import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { uiSpecificationSchema } from './uiSpecification';
import { UiSpecificationPreview } from './UiSpecificationPreview';
import { buildPresentation } from './presentation';
import { generateTsx } from './generateTsx';

const document = (type: string, props: unknown) => ({ version: '1.0', root: { id: 'sample', type, props } });
const parse = (type: string, props: unknown) => uiSpecificationSchema.parse(document(type, props));
const html = (type: string, props: unknown) => renderToStaticMarkup(createElement(UiSpecificationPreview, { specification: parse(type, props) }));

describe('dialog, flag, footer and refined card boundaries', () => {
  it('starts a dialog closed with a real trigger, title, content and closing action', () => {
    const specification = parse('dialog', { title: 'Review', closeLabel: 'Cancel' });
    expect(buildPresentation(specification)).toMatchObject({ tag: 'DialogExample', props: {
      title: 'Review', triggerLabel: 'Open Review', closeLabel: 'Cancel', content: 'Example dialog. No changes are submitted.',
    } });
    const markup = html('dialog', { title: 'Review', closeLabel: 'Cancel' });
    expect(markup).toContain('aria-haspopup="dialog"'); expect(markup).toContain('aria-controls="sample--dialog"');
    expect(markup).toContain('aria-labelledby="sample--title"'); expect(markup).toContain('aria-describedby="sample--content"');
    expect(markup).toContain('id="sample--title"'); expect(markup).toContain('Cancel');
    expect(markup).not.toMatch(/<dialog[^>]*\sopen(?:[\s=>])/);
    const source = generateTsx(specification);
    expect(source).toContain('useFocusTrap<HTMLDialogElement>()'); expect(source).toContain('showModal()');
    expect(source).toContain("addEventListener('close', restoreFocus)");
    expect(source).toContain("removeEventListener('close', restoreFocus)");
    expect(source).not.toContain("from './");
  });
  it.each(['information', 'success', 'warning', 'error', 'subtle'] as const)('renders the installed %s flag semantics and icon', variant => {
    const markup = html('flag', { content: 'Status message', title: 'Status', variant, dismissible: true });
    expect(markup).toContain('role="status"'); expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('v-message-icon'); expect(markup).toContain('aria-label="Dismiss message"');
    if (variant !== 'information') expect(markup).toContain(`v-message-${variant}`);
    const source = generateTsx(parse('flag', { content: 'Status message', variant, dismissible: true }));
    expect(source).toContain('useState(true)'); expect(source).toContain('onClick={() => setVisible(false)}');
  });
  it('preserves explicit non-dismissibility without a dismiss control', () => {
    const props = { content: 'Information', dismissible: false };
    expect(buildPresentation(parse('flag', props))).toMatchObject({ props: { dismissible: false } });
    expect(html('flag', props)).not.toContain('Dismiss message');
    expect(generateTsx(parse('flag', props))).toContain('dismissible={false}');
  });
  it('renders semantic footer navigation with bounded labeled links in order', () => {
    const props = { text: 'Copyright 2026', links: [{ label: 'Privacy', href: 'https://example.com/privacy' }, { label: 'Terms', href: '/terms' }] };
    const markup = html('footer', props);
    expect(markup).toContain('<footer'); expect(markup).toContain('class="v-footer"');
    expect(markup).toContain('aria-label="Footer links"');
    expect(markup.indexOf('Privacy')).toBeLessThan(markup.indexOf('Terms'));
    const source = generateTsx(parse('footer', props));
    expect(source).toContain('href={"https://example.com/privacy"}'); expect(source).not.toContain('onClick');
    expect(source.split('\n')[0]).toContain('Footer'); expect(source.split('\n')[0]).not.toMatch(/\b(nav|ul|li)\b/);
    expect(html('footer', { text: 'Copyright' })).not.toContain('<nav');
  });
  it.each([2, 3, 4] as const)('supports a semantic h%s content card title and accessible action', headingLevel => {
    const markup = html('contentCard', { title: 'Title', description: 'Description', headingLevel, action: { label: 'Read details', href: '/details' } });
    expect(markup).toMatch(new RegExp(`<h${headingLevel}[^>]*>Title</h${headingLevel}>`));
    expect(markup).toContain('href="/details">Read details</a>');
  });
  it('keeps refined payment inputs local, unprefilled and explicitly partial', () => {
    const specification = parse('paymentCard', { name: 'card', label: 'Card details' });
    const markup = html('paymentCard', { name: 'card', label: 'Card details' });
    expect(markup.match(/inputMode="numeric"/g)).toHaveLength(2);
    expect(markup).toContain('placeholder="MM/YY"'); expect(markup).toContain('About the security code');
    expect(markup).toContain('aria-describedby="sample--security-help"');
    expect(markup).toContain('No card validation or payment processing.');
    expect(markup).not.toContain('value=');
    const source = generateTsx(specification);
    expect(source).toContain("from '@visa/nova-icons-react'");
    expect(source).not.toMatch(/onChange|localStorage|sessionStorage|fetch\(/);
  });
  it.each([
    ['dialog', { title: 'Review', content: '<script>' }], ['dialog', { title: 'Review', open: true }],
    ['dialog', { title: 'Review', closeLabel: '' }], ['dialog', { title: 'x'.repeat(201) }],
    ['flag', { content: 'Done', variant: 'critical' }], ['flag', { content: 'Done', dismissible: 'true' }],
    ['flag', { content: 'Done', onClose: 'code' }],
    ['footer', { text: 'Legal', links: [{ label: 'Bad', href: 'javascript:alert(1)' }] }],
    ['footer', { text: 'Legal', links: [{ label: '', href: '/help' }] }],
    ['footer', { text: 'Legal', links: Array.from({ length: 9 }, () => ({ label: 'Help', href: '/help' })) }],
    ['footer', { text: 'Legal', links: [{ label: 'Help', href: '/help', onClick: 'code' }] }],
    ['contentCard', { title: 'Title', description: 'Description', headingLevel: 1 }],
    ['paymentCard', { name: 'card', label: 'Card', value: 'not-allowed' }],
  ])('rejects unsafe/malformed %s properties %#', (type, props) => {
    expect(uiSpecificationSchema.safeParse(document(type, props)).success).toBe(false);
  });
});
