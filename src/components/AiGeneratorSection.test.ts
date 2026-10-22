import { Children, createElement, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { AiGeneratorView, GeneratedInterface } from './AiGeneratorSection';
import type { GenerationState } from '../utils/generationRequests';
import { uiSpecificationSchema } from '../specification/uiSpecification';
import fixture from '../specification/fixtures/registration-form.json?raw';
import { generateTsx } from '../specification/generateTsx';
import { UiSpecificationPreview } from '../specification/UiSpecificationPreview';
import OutputPanel from './OutputPanel';

afterEach(() => vi.unstubAllGlobals());
const specification = uiSpecificationSchema.parse(JSON.parse(fixture));
const view = (state: GenerationState) => AiGeneratorView({ state, onGenerate: () => {}, onCancel: () => {} });
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  return Children.toArray(node).flatMap(child => isValidElement<Record<string, unknown>>(child)
    ? [child, ...elements(child.props.children as ReactNode)] : []);
}

describe('Experimental AI integration presentation', () => {
  it('offers fillable examples and a native supported-catalog disclosure without semantic claims', () => {
    const html = renderToStaticMarkup(view({ status: 'idle' }));
    expect(html).toContain('<summary>Supported components</summary>');
    expect(html).toContain('aria-label="Example requests"');
    expect(html).toContain('type="button">Email field');
    expect(html).toContain('<textarea');
    expect(html).toContain('rows="3"');
    expect(html).toContain('Try a simpler description or name the component directly.');
    expect(html).toContain('not guaranteed outputs');
    for (const family of ['text areas', 'radio groups', 'content cards', 'payment-card fields', 'progress indicators']) {
      expect(html).toContain(family);
    }
    expect(renderToStaticMarkup(GeneratedInterface({ specification }))).toContain('Use synthetic payment details only');
  });
  it.each(['', '?generator=ai', '?generator=unknown'])('uses the AI generator at %s and keeps other generators unmounted', search => {
    vi.stubGlobal('window', { location: { search } });
    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain('id="ai-ui-desc"'); expect(html).not.toContain('id="ui-desc"');
    expect(html).not.toContain('id="registration-form"');
    expect(html).toContain('one optional form'); expect(html).toContain('Results may miss details');
    expect(html).toContain('aria-current="page">Experimental AI');
    expect(html).toContain('https://github.com/rm0929/VPDS-Component-Generator');
    expect(html).toContain('Skip to generator');
    expect(html).not.toContain('How it works');
    expect(html.match(/id="generator"/g)).toHaveLength(1);
  });
  it('only mounts keyword matching through the explicitly labeled legacy demo', () => {
    vi.stubGlobal('window', { location: { search: '?generator=keyword' } });
    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain('id="ui-desc"'); expect(html).not.toContain('id="ai-ui-desc"');
    expect(html).toContain('aria-current="page">Legacy keyword demo');
  });
  it('keeps the explicit specification demo precedence and all view links', () => {
    vi.stubGlobal('window', { location: { search: '?demo=specification&generator=ai' } });
    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain('id="registration-form"'); expect(html).not.toContain('id="ai-ui-desc"');
    for (const name of ['Legacy keyword demo', 'Experimental AI', 'Specification demo']) expect(html).toContain(name);
  });
  it.each(['idle', 'loading', 'cancelled'] as const)('announces %s and never shows old output', status => {
    const html = renderToStaticMarkup(view({ status }));
    expect(html).toContain('role="status"'); expect(html).not.toContain('aria-label="Generated React TSX"');
    expect(html).not.toContain('class="ai-preview-content"');
    if (status === 'loading') { expect(html).toContain('Cancel generation'); expect(html).toContain('aria-busy="true"'); }
    if (status === 'cancelled') expect(html).toContain('Generation cancelled.');
  });
  it.each(['error', 'unsupported'] as const)('announces a safe %s state without stale output', status => {
    const html = renderToStaticMarkup(view({ status, code: 'UNSUPPORTED_UI_REQUEST', message: 'Safe message' }));
    expect(html).toContain('role="alert"'); expect(html).toContain('Safe message'); expect(html).not.toContain('aria-label="Generated React TSX"');
    expect(html).not.toContain('class="ai-preview-content"');
  });
  it('derives preview, TSX and registry suggestions from the same specification', () => {
    const tree = GeneratedInterface({ specification });
    const children = elements(tree);
    expect(children.find(child => child.type === UiSpecificationPreview)?.props.specification).toBe(specification);
    expect(children.find(child => child.type === OutputPanel)?.props.code).toBe(generateTsx(specification));
    const html = renderToStaticMarkup(tree);
    expect(html).toContain('https://design.visa.com/react/components/input');
    expect(html).toContain('class="v-link"');
    expect(html).toContain('Label, InputContainer, Input'); expect(html).toContain('Checkbox, Label');
    expect(html).toContain('Copy code to clipboard'); expect(html).toContain('for="confirm-password"');
    const preview = children.find(child => child.props['aria-label'] === 'Generated interface');
    const preventDefault = vi.fn();
    (preview?.props.onSubmitCapture as (event: { preventDefault: () => void }) => void)({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
  });
  it('remounts the generated result for each success, including identical specifications', () => {
    const keys = [1, 2].map(generation => elements(view({ status: 'success', generation, specification, requestId: 'request' }))
      .find(child => child.type === GeneratedInterface)?.key);
    expect(keys[0]).toBeTruthy(); expect(keys[1]).not.toBe(keys[0]);
  });
});
