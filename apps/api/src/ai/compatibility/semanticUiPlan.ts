import { z } from 'zod';
import { SPEC_LIMITS } from '@vpds/ui-specification/componentRegistry';
import { draftPropsSchemas, UNSUPPORTED_REASONS } from '../modelUiDraft';

export const SEMANTIC_UI_PLAN_VERSION = '1' as const;

const indexSchema = z.number().int().min(0).max(SPEC_LIMITS.maxComponents - 1);
const referenceSchema = z.union([
  z.strictObject({ element: indexSchema }),
  z.strictObject({ group: indexSchema }),
]);
const referencesSchema = z.array(referenceSchema).min(1).max(SPEC_LIMITS.maxComponents);
const elementSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('textInput'), props: draftPropsSchemas.textInput }),
  z.strictObject({ type: z.literal('emailInput'), props: draftPropsSchemas.emailInput }),
  z.strictObject({ type: z.literal('passwordInput'), props: draftPropsSchemas.passwordInput }),
  z.strictObject({ type: z.literal('checkbox'), props: draftPropsSchemas.checkbox }),
  z.strictObject({ type: z.literal('button'), props: draftPropsSchemas.button }),
  z.strictObject({ type: z.literal('text'), props: draftPropsSchemas.text }),
  z.strictObject({ type: z.literal('heading'), props: draftPropsSchemas.heading }),
]);
const groupSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('row'), props: draftPropsSchemas.horizontalLayout, members: referencesSchema }),
  z.strictObject({ kind: z.literal('column'), props: draftPropsSchemas.verticalLayout, members: referencesSchema }),
  z.strictObject({ kind: z.literal('form'), props: draftPropsSchemas.form, members: referencesSchema }),
]);
const supportedPlanSchema = z.strictObject({
  planVersion: z.literal(SEMANTIC_UI_PLAN_VERSION),
  status: z.literal('supported'),
  elements: z.array(elementSchema).min(1).max(SPEC_LIMITS.maxComponents),
  groups: z.array(groupSchema).max(SPEC_LIMITS.maxComponents),
  content: referencesSchema,
});

export type SemanticUiElement = z.infer<typeof elementSchema>;
export type SemanticUiGroup = z.infer<typeof groupSchema>;
export type SemanticUiReference = z.infer<typeof referenceSchema>;
export type SupportedSemanticUiPlan = z.infer<typeof supportedPlanSchema>;

/** Bound unknown JS data before Zod clones it; never read accessor values. */
function isBoundedPlanJson(input: unknown): boolean {
  const pending = [{ value: input, depth: 0 }];
  const seen = new Set<object>();
  let count = 0;
  try {
    while (pending.length) {
      const { value, depth } = pending.pop()!;
      if (++count > SPEC_LIMITS.maxJsonValues || depth > SPEC_LIMITS.maxDepth * 3 + 3) return false;
      if (value === null || typeof value === 'boolean') continue;
      if (typeof value === 'string') { if (value.length > SPEC_LIMITS.maxTextLength) return false; continue; }
      if (typeof value === 'number') { if (!Number.isFinite(value)) return false; continue; }
      if (typeof value !== 'object' || seen.has(value)) return false;
      seen.add(value);
      if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false;
      const keys = Reflect.ownKeys(value);
      if (keys.length + pending.length > SPEC_LIMITS.maxJsonValues - count) return false;
      if (Array.isArray(value) && keys.length !== value.length + 1) return false;
      for (const key of keys) {
        if (Array.isArray(value) && key === 'length') continue;
        if (typeof key !== 'string') return false;
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
        if (!descriptor.enumerable || !('value' in descriptor)) return false;
        pending.push({ value: descriptor.value, depth: depth + 1 });
      }
    }
    return true;
  } catch { return false; }
}

function validateRelationships(plan: SupportedSemanticUiPlan, ctx: z.RefinementCtx) {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
  const rootDepth = plan.content.length > 1 ? 2 : 1;
  if (plan.elements.length + plan.groups.length + Number(plan.content.length > 1) > SPEC_LIMITS.maxComponents) {
    issue([], 'The composed UI exceeds the component limit, including its implicit root.');
  }

  // Count ownership across ALL declarations, not only nodes reached from content.
  const elementOwners = new Array<number>(plan.elements.length).fill(0);
  const groupOwners = new Array<number>(plan.groups.length).fill(0);
  let invalidIndex = false;
  const countReference = (ref: SemanticUiReference, path: (string | number)[]) => {
    const key = 'element' in ref ? 'element' : 'group';
    const index = 'element' in ref ? ref.element : ref.group;
    const owners = key === 'element' ? elementOwners : groupOwners;
    // Zod may continue refinement after range errors; never trust an index here.
    if (!Number.isInteger(index) || index < 0 || index >= owners.length) {
      issue([...path, key], 'The reference index is outside its declared array.');
      invalidIndex = true;
    } else owners[index]++;
  };
  plan.content.forEach((ref, index) => countReference(ref, ['content', index]));
  plan.groups.forEach((group, index) => group.members.forEach((ref, member) => countReference(ref, ['groups', index, 'members', member])));
  if (invalidIndex) return;

  let invalidOwnership = false;
  for (const [key, owners] of [['elements', elementOwners], ['groups', groupOwners]] as const) {
    owners.forEach((count, index) => {
      if (count !== 1) {
        issue([key, index], 'Every element and group must have exactly one reference.');
        invalidOwnership = true;
      }
    });
  }

  // Check every group, including disconnected cycles with one owner per node.
  const states = new Array<0 | 1 | 2>(plan.groups.length).fill(0);
  let cycle = false;
  const checkCycle = (index: number, path: (string | number)[]) => {
    if (states[index] === 1) { issue(path, 'Groups must not form cycles.'); cycle = true; return; }
    if (states[index] === 2) return;
    states[index] = 1;
    plan.groups[index].members.forEach((ref, member) => {
      if ('group' in ref) checkCycle(ref.group, ['groups', index, 'members', member, 'group']);
    });
    states[index] = 2;
  };
  plan.groups.forEach((_, index) => checkCycle(index, ['groups', index]));
  if (invalidOwnership || cycle) return;

  // A finite acyclic graph with exactly one owner per node is rooted in content:
  // an unreachable acyclic branch would have an ownerless root, rejected above.
  const visit = (ref: SemanticUiReference, depth: number, insideForm: boolean, path: (string | number)[]) => {
    if (depth > SPEC_LIMITS.maxDepth) { issue(path, 'The composed UI exceeds the nesting limit.'); return; }
    if ('element' in ref) {
      const element = plan.elements[ref.element];
      if (element.type === 'button' && element.props.type !== 'button' && !insideForm) {
        issue(['elements', ref.element], 'Submit/reset buttons require explicit form membership.');
      }
      return;
    }
    const group = plan.groups[ref.group];
    if (group.kind === 'form' && insideForm) issue(['groups', ref.group], 'Form groups cannot be nested.');
    group.members.forEach((member, index) => visit(member, depth + 1, insideForm || group.kind === 'form', ['groups', ref.group, 'members', index]));
  };
  plan.content.forEach((ref, index) => visit(ref, rootDepth, false, ['content', index]));
}

// JSON Schema can express this shape, but not ownership, cycles or form ancestry.
// Exposed only to derive Ollama's grammar; compilation always uses the full validator.
export const semanticUiPlanStructureSchema = z.discriminatedUnion('status', [
  supportedPlanSchema,
  z.strictObject({ planVersion: z.literal(SEMANTIC_UI_PLAN_VERSION), status: z.literal('unsupported'), reason: z.enum(UNSUPPORTED_REASONS) }),
]);
const planSchema = semanticUiPlanStructureSchema.superRefine((plan, ctx) => {
  if (plan.status === 'supported') validateRelationships(plan, ctx);
});

/** Validates data shape, strict props, ownership, cycles, complexity and form scope. */
export const semanticUiPlanSchema = z.unknown().refine(isBoundedPlanJson, {
  message: 'Expected bounded JSON semantic plan data.',
}).pipe(planSchema);
export type SemanticUiPlan = z.infer<typeof semanticUiPlanSchema>;
