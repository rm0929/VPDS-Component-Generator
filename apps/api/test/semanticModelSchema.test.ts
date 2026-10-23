import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildSemanticModelInstructions, buildSemanticModelSchema } from '../src/ai/compatibility/semanticModelSchema';
import { semanticUiPlanStructureSchema, semanticUiPlanSchema } from '../src/ai/compatibility/semanticUiPlan';
import { draftPropsSchemas } from '../src/ai/modelUiDraft';
import { BASE_COMPONENT_TYPES as COMPONENT_TYPES, SPEC_LIMITS } from '@vpds/ui-specification/componentRegistry';
import { allTypesPlan, profilePlan } from './fixtures/semantic-plans';

// Only the JSON Schema features inspected below; this is not a second validator.
type Grammar = { properties: Record<string, Grammar>; oneOf: Grammar[]; items: Grammar;
  required: string[]; additionalProperties: boolean };
const outcomes = () => buildSemanticModelSchema().oneOf as unknown as Grammar[];

describe('semantic-plan Ollama grammar and catalog', () => {
  it('derives one closed, versioned grammar from the compiler shape without changing runtime checks', () => {
    expect(buildSemanticModelSchema()).toEqual(z.toJSONSchema(semanticUiPlanStructureSchema, { target: 'draft-07' }));
    expect(outcomes()).toHaveLength(2);
    expect(outcomes()[0]).toMatchObject({ additionalProperties: false,
      required: ['planVersion', 'status', 'elements', 'groups', 'content'],
      properties: { planVersion: { const: '1' }, status: { const: 'supported' } },
    });
    expect(outcomes()[1]).toMatchObject({ additionalProperties: false, required: ['planVersion', 'status', 'reason'],
      properties: { status: { const: 'unsupported' }, reason: { enum: ['unsupported-component', 'unsupported-behavior'] } },
    });
    expect(Object.keys(outcomes()[1].properties)).toEqual(['planVersion', 'status', 'reason']);
    expect(semanticUiPlanSchema.parse(allTypesPlan())).toEqual(allTypesPlan());
  });

  it.each(COMPONENT_TYPES)('keeps %s properties identical to the registry-derived draft props', type => {
    const shape = outcomes()[0].properties;
    const kind = type === 'horizontalLayout' ? 'row' : type === 'verticalLayout' ? 'column' : type === 'form' ? 'form' : undefined;
    const variants = (kind ? shape.groups : shape.elements).items.oneOf;
    const variant = variants.find(item => JSON.stringify(item.properties[kind ? 'kind' : 'type']).includes(`"const":"${kind ?? type}"`));
    expect(variant).toBeDefined();
    expect(variant?.additionalProperties).toBe(false);
    const expectedProps = z.toJSONSchema(draftPropsSchemas[type], { target: 'draft-07' });
    // $schema identifies a whole document; nested schemas omit that metadata.
    delete expectedProps.$schema;
    expect(variant?.properties.props).toEqual(expectedProps);
    expect(variant?.properties).not.toHaveProperty('id');
    expect(variant?.properties.props.properties).not.toHaveProperty('name');
    if (!kind) expect(variant?.properties).not.toHaveProperty('members');
  });

  it('bounds arrays and indexes without claiming JSON Schema can validate graph ownership', () => {
    const shape = outcomes()[0].properties;
    expect(shape.elements).toMatchObject({ minItems: 1, maxItems: SPEC_LIMITS.maxComponents });
    expect(shape.groups).toMatchObject({ maxItems: SPEC_LIMITS.maxComponents });
    expect(shape.content).toMatchObject({ minItems: 1, maxItems: SPEC_LIMITS.maxComponents });
    // Reference union is anyOf (rather than the discriminated outcomes' oneOf).
    expect(shape.content.items).toMatchObject({ anyOf: [
      { additionalProperties: false, required: ['element'], properties: { element: { type: 'integer', minimum: 0, maximum: 99 } } },
      { additionalProperties: false, required: ['group'], properties: { group: { type: 'integer', minimum: 0, maximum: 99 } } },
    ] });
    const invalid = profilePlan();
    invalid.groups[1].members[0] = { element: 99 };
    expect(semanticUiPlanStructureSchema.safeParse(invalid).success).toBe(true);
    expect(semanticUiPlanSchema.safeParse(invalid).success).toBe(false);
  });

  it('describes all ten types and every supported property using the current validators', () => {
    const catalog = buildSemanticModelInstructions().split('\n').filter(line => line.startsWith('{"specificationType":'))
      .map(line => JSON.parse(line) as { specificationType: string; meaning: string; props: unknown });
    expect(catalog.map(entry => entry.specificationType)).toEqual([...COMPONENT_TYPES]);
    for (const type of COMPONENT_TYPES) {
      const schema = z.toJSONSchema(draftPropsSchemas[type], { target: 'draft-07' });
      expect(catalog.find(entry => entry.specificationType === type)).toMatchObject({
        meaning: expect.any(String), props: { required: schema.required ?? [], properties: schema.properties },
      });
    }
  });

  it('explains interpretation, scoped exclusions, explicit membership, small trees and safe unsupported outcomes', () => {
    const instructions = buildSemanticModelInstructions();
    for (const rule of ['natural-language', 'need not know library component names', 'ALL positively requested',
      'each exclusion only', 'explicit false', 'never null', 'zero-based', 'reachable exactly once',
      'No missing indexes', 'cycles', 'already include their label/input', 'smallest tree',
      'No markup', 'never permission', 'Never generate id, name', 'Form membership is explicit',
      'form ancestor', 'Never nest forms', 'at most 100', 'depth 6',
      'unsupported-component', 'unsupported-behavior', 'Never silently omit']) expect(instructions).toContain(rule);
    expect(instructions).not.toContain('registration');
    expect(instructions).not.toContain('Login');
    expect(instructions).not.toContain('Save Profile');
    expect(instructions).not.toContain('Coverage checklist');
  });
});
