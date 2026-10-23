import { describe, expect, it } from 'vitest';
import { buildGroqSelectionSchema, createStrictSchemaAdapter, decodeGroqSelection, encodeGroqSelection, groqSelectionMessages } from '../src/ai/groqSelectionSchema';
import { selectionCatalog, selectionMessages } from '../src/ai/model';
import { compileSelectionPoc } from '../src/ai/selection';
import { uiSpecificationSchema } from '@vpds/ui-specification/uiSpecification';

const selected = (components: unknown[]) => ({ version: 'selection-poc-2', form: { enabled: false, label: null }, components, unsupported: [] });
describe('Groq strict wire grammar (offline compatibility checks, not server acceptance)', () => {
  it.each(Object.entries(selectionCatalog))('round-trips %s without changing the authoritative result', (type, entry) => {
    const selection = selected([{ type, props: entry.props }]);
    const decoded = decodeGroqSelection(encodeGroqSelection(selection));
    expect(decoded).toEqual(selection);
    expect(uiSpecificationSchema.safeParse(compileSelectionPoc(decoded)).success).toBe(true);
  });

  it('uses only closed all-required objects and anyOf unions in the wire schema', () => {
    const schema = buildGroqSelectionSchema(); let objects = 0;
    function visit(value: unknown) {
      if (!value || typeof value !== 'object') return;
      const node = value as Record<string, unknown>;
      expect(node).not.toHaveProperty('oneOf'); expect(node).not.toHaveProperty('const');
      expect(node).not.toHaveProperty('$schema'); expect(node).not.toHaveProperty('examples');
      if (node.type === 'object') {
        objects++;
        expect(node.additionalProperties).toBe(false);
        expect(node.required).toEqual(Object.keys(node.properties as object));
      }
      Object.values(node).forEach(item => Array.isArray(item) ? item.forEach(visit) : visit(item));
    }
    visit(schema); expect(objects).toBeGreaterThan(20);
    (schema as Record<string, unknown>).type = 'modified';
    expect(buildGroqSelectionSchema().type).toBe('object');
  });

  it('removes only schema-declared optional nulls and preserves false, zero and required null', () => {
    const input = selected([
      { type: 'switch', props: { label: 'Dark mode', defaultChecked: false, disabled: false }, besidePrevious: false },
      { type: 'progress', props: { label: 'Export', mode: 'determinate', value: 0, paused: false } },
      { type: 'contentCard', props: { title: 'Help', description: 'Details', action: { label: 'Read' } } },
    ]);
    const wire = encodeGroqSelection(input);
    expect(JSON.stringify(wire)).toContain('"headingLevel":null');
    expect(decodeGroqSelection(wire)).toEqual(input);
    const nullable = createStrictSchemaAdapter({ type: 'object', required: ['requiredNull'], properties: {
      requiredNull: { type: 'null' }, optionalNullable: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      optionalBoolean: { type: 'boolean' },
    } });
    expect(nullable.decode({ requiredNull: null, optionalNullable: null, optionalBoolean: null }))
      .toEqual({ requiredNull: null, optionalNullable: null });
  });

  it('rejects missing wire properties, required nulls, unknown keys and invalid relationships', () => {
    const wire = encodeGroqSelection(selected([{ type: 'emailInput', props: { label: 'Email' } }])) as { components: { props: Record<string, unknown> }[] };
    const missing = structuredClone(wire); delete missing.components[0].props.disabled;
    expect(() => decodeGroqSelection(missing)).toThrow();
    const required = structuredClone(wire); required.components[0].props.label = null;
    expect(() => decodeGroqSelection(required)).toThrow();
    const unsafe = structuredClone(wire); unsafe.components[0].props.onClick = null;
    expect(() => decodeGroqSelection(unsafe)).toThrow();
    expect(() => decodeGroqSelection(encodeGroqSelection(selected([{ type: 'button', props: { label: 'Go', type: 'submit' } }]))))
      .not.toThrow(); // Form ancestry remains the existing composer's responsibility.
    expect(() => compileSelectionPoc(decodeGroqSelection(encodeGroqSelection(selected([{ type: 'button', props: { label: 'Go', type: 'submit' } }]))))).toThrow();
  });

  it('rejects unsupported URLs, excess counts, non-JSON values, cycles and accessors', () => {
    expect(() => encodeGroqSelection(selected([{ type: 'link', props: { label: 'Bad', href: 'javascript:alert(1)' } }]))).toThrow();
    expect(() => encodeGroqSelection(selected(Array.from({ length: 21 }, () => ({ type: 'text', props: { content: 'Too many' } }))))).toThrow();
    const cyclic: { self?: unknown } = {}; cyclic.self = cyclic;
    expect(() => decodeGroqSelection(cyclic)).toThrow();
    expect(() => decodeGroqSelection({ get value() { throw new Error('Must not execute'); } })).toThrow();
    expect(() => decodeGroqSelection({ value: undefined })).toThrow();
  });

  it('adapts only Groq wire instructions/examples, leaving the original Ollama prompt unchanged', () => {
    const original = selectionMessages(); const snapshot = JSON.stringify(original);
    const messages = groqSelectionMessages();
    expect(JSON.stringify(selectionMessages())).toBe(snapshot);
    expect(messages[0].content).toContain('Use null for unspecified optional properties');
    expect(original[0].content).toContain('Omit unspecified optional props instead of using null.');
    messages.forEach((message, index) => {
      if (message.role === 'assistant') expect(decodeGroqSelection(JSON.parse(message.content))).toEqual(JSON.parse(original[index].content));
      else if (message.role === 'user') expect(message).toEqual(original[index]);
    });
  });
});
