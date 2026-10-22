import { describe, expect, it, vi } from 'vitest';
import { compileSelectionPoc, selectionSchema } from '../src/ai/selection';
import { buildSelectionModelSchema, selectionMessages } from '../src/ai/model';
import { createOllamaProvider } from '../src/ai/ollamaProvider';
import { readProviderConfig } from '../src/providerConfig';
import { uiSpecificationSchema } from '@vpds/ui-specification/uiSpecification';
import { generateTsx } from '@vpds/ui-specification/generateTsx';
import { checkGeneratedTsx } from '../../../packages/ui-specification/test/support/checkGeneratedTsx';
import type { UiNode } from '@vpds/ui-specification/componentRegistry';

const components = [
  { type: 'textarea', props: { label: 'Notes', rows: 4, maxLength: 300, required: false, disabled: false } },
  { type: 'switch', props: { label: 'Alerts', defaultChecked: false, disabled: false } },
  { type: 'badge', props: { content: 'Ready', badgeType: 'stable' } },
  { type: 'divider', props: { dividerType: 'section' } },
  { type: 'link', props: { label: 'Help', href: '/help?a=1&b=2' } },
  { type: 'select', props: { label: 'Region', options: ['East', 'West'], defaultValue: 'West', required: false, disabled: false } },
  { type: 'radioGroup', props: { label: 'Delivery', options: ['Standard', 'Express'], defaultValue: 'Standard', required: false, disabled: false } },
  { type: 'contentCard', props: { title: 'Release', description: 'Ready', action: { label: 'Explore', href: '/release' } } },
  { type: 'paymentCard', props: { label: 'Card details', includeCardholder: false, required: false, disabled: false } },
  { type: 'progress', props: { label: 'Upload', mode: 'determinate', value: 0, paused: false } },
  { type: 'progress', props: { label: 'Export', mode: 'indeterminate', paused: false } },
  { type: 'dialog', props: { title: 'Review', content: 'Review details.', triggerLabel: 'Review details', closeLabel: 'Cancel' } },
  { type: 'flag', props: { content: 'Updated', variant: 'success', dismissible: true } },
  { type: 'flag', props: { content: 'Information', variant: 'information', dismissible: false } },
  { type: 'footer', props: { text: 'Example service', links: [{ label: 'Terms', href: '/terms' }] } },
];
const selection = (items: unknown[] = components, form = false) => ({
  version: 'selection-poc-2', components: items, form: { enabled: form, label: form ? 'Settings' : null }, unsupported: [],
});
const nodes = (node: UiNode): UiNode[] => [node, ...(node.children?.flatMap(nodes) ?? [])];

describe('flat selection catalog increment through the existing compiler', () => {
  it.each(components)('compiles $type without changing selected properties', component => {
    const input = selection([component]);
    const before = JSON.stringify(input);
    const output = compileSelectionPoc(input);
    expect(output.root.type).toBe(component.type);
    expect(output.root.props).toMatchObject(component.props);
    expect(uiSpecificationSchema.safeParse(output).success).toBe(true);
    expect(compileSelectionPoc(input)).toEqual(output);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('preserves adjacent rows, forms and all old/new field-name collisions', () => {
    const output = compileSelectionPoc(selection([
      { type: 'textInput', props: { label: 'Café' } },
      { type: 'textarea', props: { label: 'Cafe', required: false }, besidePrevious: true },
      { type: 'switch', props: { label: 'Café', defaultChecked: false } },
      { type: 'button', props: { label: 'Apply', type: 'submit' } },
    ], true));
    expect(output.root.type).toBe('form');
    const all = nodes(output.root);
    expect(all.filter(node => 'name' in node.props).map(node => 'name' in node.props && node.props.name))
      .toEqual(['cafe', 'cafe-2', 'cafe-3']);
    expect(all.find(node => node.type === 'horizontalLayout')?.children?.map(node => node.type)).toEqual(['textInput', 'textarea']);
    expect(all.find(node => node.type === 'switch')?.props).toMatchObject({ defaultChecked: false });
  });

  it('rejects unsafe destinations at the selection boundary and keeps the same limits', () => {
    const result = selectionSchema.safeParse(selection([{ type: 'link', props: { label: 'Help', href: 'javascript:alert(1)' } }]));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ['components', 0, 'props', 'href'], code: 'custom' }));
    expect(selectionSchema.safeParse(selection(Array.from({ length: 21 }, () => ({ type: 'divider', props: {} })))).success).toBe(false);
    expect(selectionSchema.safeParse(selection([{ type: 'textarea', props: { label: 'Notes', name: 'model-owned' } }])).success).toBe(false);
    expect(selectionSchema.safeParse(selection([{ type: 'switch', props: { label: 'Alerts', defaultChecked: 'false' } }])).success).toBe(false);
  });

  it.each(components)('uses the production Ollama transport for $type with mocked HTTP', async component => {
    const config = readProviderConfig({ API_PROVIDER: 'ollama', OLLAMA_WORKFLOW: 'flat-selection' });
    if (config.provider !== 'ollama') throw new Error('Expected Ollama');
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      done: true, done_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(selection([component])) },
    })));
    const result = await createOllamaProvider(config, request).generate('Ordinary UI request', { signal: new AbortController().signal });
    expect(result).toEqual(compileSelectionPoc(selection([component])));
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe('http://127.0.0.1:11434/api/chat');
    const body = JSON.parse(String(request.mock.calls[0][1]?.body));
    expect(body.format).toEqual(buildSelectionModelSchema());
    expect(body.messages).toEqual([...selectionMessages(), { role: 'user', content: 'Ordinary UI request' }]);
  });

  it('rejects an unsafe model destination as invalid provider output without echoing it', async () => {
    const config = readProviderConfig({ API_PROVIDER: 'ollama', OLLAMA_WORKFLOW: 'flat-selection' });
    if (config.provider !== 'ollama') throw new Error('Expected Ollama');
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      done: true, message: { role: 'assistant', content: JSON.stringify(selection([
        { type: 'link', props: { label: 'Help', href: 'javascript:PRIVATE' } },
      ])) },
    })));
    await expect(createOllamaProvider(config, request).generate('Ordinary UI request', { signal: new AbortController().signal }))
      .rejects.toMatchObject({ code: 'INVALID_PROVIDER_OUTPUT', message: expect.not.stringContaining('PRIVATE') });
  });

  it('compiles individual and composed TSX against installed Nova 2.5.4 without execution', () => {
    const cases = [...components.map(component => selection([component])), selection(), selection(components, true),
      selection([{ type: 'textarea', props: { label: 'Notes "quoted" & literal', placeholder: '雪', disabled: true } },
        { type: 'switch', props: { label: 'Updates', disabled: true, defaultChecked: true }, besidePrevious: true }]),
    ];
    expect(checkGeneratedTsx(cases.map(input => generateTsx(compileSelectionPoc(input))))).toEqual([]);
  }, 20000);
});
