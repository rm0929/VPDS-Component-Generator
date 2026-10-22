import { describe, expect, it, vi } from 'vitest';
import { createOllamaProvider } from '../src/ai/ollamaProvider';
import { readProviderConfig } from '../src/providerConfig';
import { z } from 'zod';
import { BASE_COMPONENT_TYPES as COMPONENT_TYPES, componentRegistry, SPEC_LIMITS } from '@vpds/ui-specification/componentRegistry';
import registration from '../src/ai/compatibility/fixtures/registration-draft.json';
import { modelUiDraftSchema, draftPropsSchemas } from '../src/ai/modelUiDraft';
import type { DraftNode } from '../src/ai/modelUiDraft';
import { compileModelUi } from '../src/ai/compileModelUi';
import { buildModelInstructions, buildModelSchema, MODEL_EXAMPLE_REQUEST } from '../src/ai/compatibility/modelSchema';
import { deriveFormExpectation, evaluateCoverage } from '../../../tools/evaluation/coverage/requirementCoverage';
import { coverageCases } from '../../../tools/evaluation/coverage/coverageCases';

const supported = () => (buildModelSchema().oneOf as { properties: unknown; required: string[]; additionalProperties: boolean }[])[0];
describe('one model-facing UI draft grammar', () => {
  it('defines closed versioned outcomes, finite references, and no impossible "not" rules', () => {
    const schema = buildModelSchema();
    expect(supported()).toMatchObject({ additionalProperties: false, required: ['irVersion', 'status', 'root'],
      properties: { irVersion: { const: '1' }, status: { const: 'supported' }, root: { $ref: '#/definitions/node-1' } },
    });
    const definitions = schema.definitions as Record<string, unknown>;
    const refs = [...JSON.stringify(schema).matchAll(/"\$ref":"#\/definitions\/([^"\s]+)"/g)].map(match => match[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const reference of refs) expect(definitions).toHaveProperty(reference);
    expect(JSON.stringify(schema)).not.toContain('"not":');
    expect(definitions['node-7']).toBeUndefined();
    expect(definitions['node-6-form']).toBeUndefined();
    expect(definitions['node-6-textInput']).toBeDefined();
  });

  it.each(COMPONENT_TYPES)('derives %s rules from the registry without technical identity', type => {
    const definitions = buildModelSchema().definitions as Record<string, unknown>;
    const props = z.toJSONSchema(draftPropsSchemas[type], { target: 'draft-07' });
    expect(definitions[`props-${type}`]).toEqual(props);
    const authoritative = z.toJSONSchema(componentRegistry[type].propsSchema, { target: 'draft-07' });
    for (const [key, property] of Object.entries(authoritative.properties ?? {})) {
      if (key !== 'name') expect(props.properties?.[key]).toEqual(property);
    }
    expect(props.properties).not.toHaveProperty('name');
    expect(definitions[`node-1-${type}`]).toMatchObject({ additionalProperties: false,
      properties: { type: { const: type }, props: { $ref: `#/definitions/props-${type}` } },
    });
    const definition = definitions[`node-1-${type}`] as { properties: Record<string, unknown>; required: string[] };
    expect(definition.properties).not.toHaveProperty('id');
    if (componentRegistry[type].allowedChildren.length) expect(definition.required).toContain('children');
    else expect(definition.properties).not.toHaveProperty('children');
  });

  it('excludes direct form-under-form and excludes containers from level-six children', () => {
    const definitions = buildModelSchema().definitions as Record<string, { properties: { children: { items: { oneOf: { $ref: string }[] }; minItems: number; maxItems: number } } }>;
    const form = definitions['node-1-form'].properties.children;
    expect(form.items.oneOf.some(ref => ref.$ref === '#/definitions/node-2-form')).toBe(false);
    expect(form).toMatchObject({ minItems: 1, maxItems: SPEC_LIMITS.maxComponents });
    for (const ref of definitions['node-5-verticalLayout'].properties.children.items.oneOf) {
      expect(ref.$ref).not.toMatch(/(?:form|verticalLayout|horizontalLayout)$/);
    }
  });

  it('represents every fixture node and compiles it into the unchanged authoritative contract', () => {
    const parsed = modelUiDraftSchema.parse(registration);
    if (parsed.status !== 'supported') throw new Error('Expected supported fixture');
    const definitions = buildModelSchema().definitions as Record<string, unknown>;
    const visit = (node: DraftNode, depth: number) => {
      expect(definitions[`node-${depth}-${node.type}`]).toBeDefined();
      node.children?.forEach(child => visit(child, depth + 1));
    };
    visit(parsed.root, 1);
    expect(compileModelUi(parsed).version).toBe('1.0');
    expect(parsed).toEqual(registration);
  });

  it('explains semantic and safety rules without asking the model to invent identity', () => {
    const instructions = buildModelInstructions();
    for (const text of ['unique', 'Maximum depth is 6', 'maximum TOTAL nodes', 'Forms must not be nested',
      'Submit/reset', 'never executable code', 'No HTML, JSX, JS, imports, handlers', 'user message', 'cross-field',
      'Never generate id or name', 'unsupported-component', 'unsupported-behavior', 'including false']) {
      expect(instructions).toContain(text);
    }
    for (const type of COMPONENT_TYPES) expect(instructions).toContain(`"type":"${type}"`);
  });

  it('has one general root and an explicit closed unsupported outcome', () => {
    expect(supported().properties).toMatchObject({ root: { $ref: '#/definitions/node-1' } });
    expect(buildModelSchema().oneOf).toMatchObject([{}, { additionalProperties: false,
      required: ['irVersion', 'status', 'reason'], properties: {
        status: { const: 'unsupported' }, reason: { enum: ['unsupported-component', 'unsupported-behavior'] },
      },
    }]);
    expect(JSON.stringify(buildModelSchema())).not.toContain('requested-form');
  });

  it('embeds a complete validated draft example with full registration coverage', () => {
    const instructions = buildModelInstructions();
    expect(instructions).toContain(MODEL_EXAMPLE_REQUEST);
    const example = JSON.parse(instructions.split('Example response: ')[1].split('\n')[0]) as unknown;
    expect(modelUiDraftSchema.parse(example)).toEqual(registration);
    expect(evaluateCoverage(compileModelUi(example), deriveFormExpectation(MODEL_EXAMPLE_REQUEST)).passed).toBe(true);
    for (const rule of ['Cover EVERY', 'not a substitute', 'do not copy unrelated fields', 'never omit requested controls', 'two separate passwordInput', 'Silently']) {
      expect(instructions.toLowerCase()).toContain(rule.toLowerCase());
    }
    expect(JSON.stringify(example)).not.toContain('"name":');
    expect(JSON.stringify(example)).not.toContain('"id":');
  });

  it.each(coverageCases.filter(item => item.expectation.scope === 'form'))(
    'uses the same schema for $id without encoding its requested controls', async ({ prompt }) => {
      const config = readProviderConfig({ API_PROVIDER: 'ollama' });
      if (config.provider !== 'ollama') throw new Error('Expected Ollama config');
      const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ done: true, message: { role: 'assistant', content: JSON.stringify(registration) } })));
      await createOllamaProvider(config, request).generate(prompt, { signal: new AbortController().signal });
      const format = JSON.parse(String(request.mock.calls[0][1]?.body)).format;
      expect(format.oneOf[0].properties.root).toEqual({ $ref: '#/definitions/node-1' });
      const definitions = format.definitions as Record<string, unknown>;
      for (const type of COMPONENT_TYPES) expect(definitions[`node-1-${type}`]).toBeDefined();
      expect(definitions).not.toHaveProperty('requested-fields');
    },
  );
});
