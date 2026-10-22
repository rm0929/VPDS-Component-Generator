import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { dialogExampleSource, flagExampleSource } from '../../src/specification/interactions/interactionSource';
import { compileSelectionPoc } from '../evaluation/selection-poc/selection';
import { generateTsx } from '../../src/specification/generateTsx';
import { checkGeneratedTsx } from '../evaluation/selection-poc/checkTsx';

it.each([['DialogExample', dialogExampleSource], ['FlagExample', flagExampleSource]])('keeps copied %s behavior identical to the trusted preview function', (name, source) => {
  const preview = readFileSync(resolve(__dirname, `../../src/specification/interactions/${name}.tsx`), 'utf8');
  const body = preview.slice(preview.indexOf('export function ')).replace('export function ', 'function ');
  expect(source.slice(source.indexOf('function '))).toBe(body);
});
it('compiles a mixed composition with independent dialogs/flags and all required imports', () => {
  const specification = compileSelectionPoc({ version: 'selection-poc-2', form: { enabled: false, label: null }, unsupported: [], components: [
    { type: 'dialog', props: { title: 'Review "quoted" & literal', closeLabel: 'Cancel' } },
    { type: 'dialog', props: { title: 'Second dialog', content: '雪' } },
    { type: 'flag', props: { content: 'Updated', variant: 'success', dismissible: true } },
    { type: 'flag', props: { content: 'Information', dismissible: false } },
    { type: 'footer', props: { text: 'Example', links: [{ label: 'Help', href: '/help?a=1&b=2' }] } },
    { type: 'paymentCard', props: { label: 'Card details' } },
  ] });
  const code = generateTsx(specification);
  expect(code.match(/function DialogExample\(/g)).toHaveLength(1);
  expect(code.match(/function FlagExample\(/g)).toHaveLength(1);
  expect(checkGeneratedTsx([code])).toEqual([]);
}, 20000);
