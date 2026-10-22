import { z } from 'zod';
import { componentRegistry, SPEC_LIMITS } from '../../src/specification/componentRegistry';
import type { ComponentType, ContainerType } from '../../src/specification/componentRegistry';

export const UI_DRAFT_VERSION = '1' as const;
export const UNSUPPORTED_REASONS = ['unsupported-component', 'unsupported-behavior'] as const;

// Reuse authoritative validators; only identity belongs to the compiler.
export const draftPropsSchemas = {
  textInput: componentRegistry.textInput.propsSchema.omit({ name: true }),
  emailInput: componentRegistry.emailInput.propsSchema.omit({ name: true }),
  passwordInput: componentRegistry.passwordInput.propsSchema.omit({ name: true }),
  checkbox: componentRegistry.checkbox.propsSchema.omit({ name: true }),
  textarea: componentRegistry.textarea.propsSchema.omit({ name: true }),
  switch: componentRegistry.switch.propsSchema.omit({ name: true }),
  badge: componentRegistry.badge.propsSchema, divider: componentRegistry.divider.propsSchema,
  link: componentRegistry.link.propsSchema,
  select: componentRegistry.select.propsSchema.omit({ name: true }),
  radioGroup: componentRegistry.radioGroup.propsSchema.omit({ name: true }),
  contentCard: componentRegistry.contentCard.propsSchema,
  paymentCard: componentRegistry.paymentCard.propsSchema.omit({ name: true }),
  progress: componentRegistry.progress.propsSchema,
  dialog: componentRegistry.dialog.propsSchema, flag: componentRegistry.flag.propsSchema, footer: componentRegistry.footer.propsSchema,
  button: componentRegistry.button.propsSchema, text: componentRegistry.text.propsSchema,
  heading: componentRegistry.heading.propsSchema, verticalLayout: componentRegistry.verticalLayout.propsSchema,
  horizontalLayout: componentRegistry.horizontalLayout.propsSchema, form: componentRegistry.form.propsSchema,
} as const;

interface DraftChildren { children: DraftNode[] }
export type DraftNode = {
  [T in ComponentType]: { type: T; props: z.infer<typeof draftPropsSchemas[T]> }
    & (T extends ContainerType ? DraftChildren : { children?: never });
}[ComponentType];

function nodeSchema(depth: number): z.ZodType<DraftNode> {
  const children = z.array(depth < SPEC_LIMITS.maxDepth ? nodeSchema(depth + 1) : z.never())
    .min(1).max(SPEC_LIMITS.maxComponents);
  const node = <T extends ComponentType>(type: T) => z.strictObject({ type: z.literal(type), props: draftPropsSchemas[type] });
  return z.discriminatedUnion('type', [
    node('textInput'), node('emailInput'), node('passwordInput'), node('checkbox'),
    node('button'), node('text'), node('heading'),
    node('textarea'), node('switch'), node('badge'), node('divider'), node('link'),
    node('select'), node('radioGroup'), node('contentCard'), node('paymentCard'), node('progress'), node('dialog'), node('flag'), node('footer'),
    node('verticalLayout').extend({ children }), node('horizontalLayout').extend({ children }),
    node('form').extend({ children }),
  ]);
}

// Bound unknown JS input before Zod reads/clones it. Never invoke accessors.
function boundedJson(input: unknown): boolean {
  const pending = [{ value: input, depth: 0 }];
  const seen = new Set<object>();
  let count = 0;
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
}

const outcomeSchema = z.discriminatedUnion('status', [
  z.strictObject({ irVersion: z.literal(UI_DRAFT_VERSION), status: z.literal('supported'), root: nodeSchema(1) }),
  z.strictObject({ irVersion: z.literal(UI_DRAFT_VERSION), status: z.literal('unsupported'), reason: z.enum(UNSUPPORTED_REASONS) }),
]).superRefine((draft, ctx) => {
  if (draft.status !== 'supported') return;
  let count = 0;
  const visit = (node: DraftNode) => { count++; node.children?.forEach(visit); };
  visit(draft.root);
  if (count > SPEC_LIMITS.maxComponents) ctx.addIssue({ code: 'custom', path: ['root'], message: 'Draft component limit exceeded' });
});

export const modelUiDraftSchema = z.unknown().refine(boundedJson, { message: 'Expected bounded JSON draft data' }).pipe(outcomeSchema);
export type ModelUiDraft = z.infer<typeof modelUiDraftSchema>;
