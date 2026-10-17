import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import App from '../App';
import SpecificationDemo from './SpecificationDemo';

afterEach(() => vi.unstubAllGlobals());

it('shows the fixture preview, generated source, and local-only demo explanation', () => {
  const html = renderToStaticMarkup(createElement(SpecificationDemo));
  expect(html).toContain('UI specification demo');
  expect(html).toContain('It does not create an account or send form data.');
  expect(html).toContain('href="?"');
  expect(html).toContain('aria-label="Create an account"');
  expect(html).toContain('for="confirm-password"');
  expect(html).toContain('Generated Code');
  expect(html).toContain('Copy code to clipboard');
  expect(html).toContain('GeneratedUI');
  expect(html).not.toContain('action=');
});

it.each(['', '?demo=other'])('keeps the keyword generator as the default view for %j', search => {
  vi.stubGlobal('window', { location: { search } });
  const html = renderToStaticMarkup(createElement(App));
  expect(html).toContain('id="ui-desc"');
  expect(html).not.toContain('id="registration-form"');
});

it('selects the fixture demo without mounting the legacy generator and duplicating field IDs', () => {
  vi.stubGlobal('window', { location: { search: '?demo=specification' } });
  const html = renderToStaticMarkup(createElement(App));
  expect(html).toContain('id="registration-form"');
  expect(html).not.toContain('id="ui-desc"');
  expect(html.match(/id="email"/g)).toHaveLength(1);
  expect(html.match(/id="generator"/g)).toHaveLength(1);
});
