import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import InputBox from './InputBox';
import OutputPanel from './OutputPanel';

it('keeps the legacy input and uses a labeled bounded multiline field only when requested', () => {
  const legacy = renderToStaticMarkup(createElement(InputBox, { onSubmit: () => {} }));
  expect(legacy).toContain('<input'); expect(legacy).not.toContain('<textarea');
  const ai = renderToStaticMarkup(createElement(InputBox, { onSubmit: () => {}, id: 'prompt', multiline: true,
    maxLength: 2000, descriptionId: 'help', examples: [{ label: 'Example', prompt: 'An email field' }] }));
  expect(ai).toContain('for="prompt"'); expect(ai).toContain('<textarea'); expect(ai).toContain('aria-describedby="help"');
  expect(ai).toContain('maxLength="2000"'); expect(ai).toContain('type="button">Example');
  expect(ai).toContain('type="submit"');
});
it('keeps empty code honest and copying disabled until real output exists', () => {
  const empty = renderToStaticMarkup(createElement(OutputPanel, { code: '' }));
  expect(empty).toContain('No code generated yet.'); expect(empty).not.toContain('<pre');
  expect(empty).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Copy code to clipboard"/);
  const populated = renderToStaticMarkup(createElement(OutputPanel, { code: 'export default function Demo() { return null; }' }));
  expect(populated).toContain('aria-label="Generated React TSX"'); expect(populated).not.toContain('Copied!');
  expect(populated).toContain('Copy code'); expect(populated).not.toMatch(/<button[^>]*disabled=""/);
});
