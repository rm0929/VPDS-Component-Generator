import { z } from 'zod';
import { SPEC_LIMITS } from '../../../src/specification/componentRegistry';
import { draftPropsSchemas } from '../../src/modelUiDraft';
import type { DraftNode } from '../../src/modelUiDraft';
import { compileModelUi } from '../../src/compileModelUi';

export const SELECTION_VERSION = 'selection-poc-2' as const;
export const DEFAULT_FORM_LABEL = 'Generated form';
export const MAX_SELECTIONS = 20;
export const LEAF_TYPES = ['textInput', 'emailInput', 'passwordInput', 'checkbox', 'button', 'text', 'heading',
  'textarea', 'switch', 'badge', 'divider', 'link', 'select', 'radioGroup', 'contentCard', 'paymentCard', 'progress', 'dialog', 'flag', 'footer'] as const;
export const UNSUPPORTED = ['component', 'property', 'behavior', 'composition'] as const;
const besidePrevious = z.boolean().optional();

export const selectionStructureSchema = z.strictObject({
  version: z.literal(SELECTION_VERSION),
  form: z.strictObject({ enabled: z.boolean(), label: draftPropsSchemas.form.shape.label.nullable() }),
  components: z.array(z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('textInput'), props: draftPropsSchemas.textInput, besidePrevious }),
    z.strictObject({ type: z.literal('emailInput'), props: draftPropsSchemas.emailInput, besidePrevious }),
    z.strictObject({ type: z.literal('passwordInput'), props: draftPropsSchemas.passwordInput, besidePrevious }),
    z.strictObject({ type: z.literal('checkbox'), props: draftPropsSchemas.checkbox, besidePrevious }),
    z.strictObject({ type: z.literal('button'), props: draftPropsSchemas.button, besidePrevious }),
    z.strictObject({ type: z.literal('text'), props: draftPropsSchemas.text, besidePrevious }),
    z.strictObject({ type: z.literal('heading'), props: draftPropsSchemas.heading, besidePrevious }),
    z.strictObject({ type: z.literal('textarea'), props: draftPropsSchemas.textarea, besidePrevious }),
    z.strictObject({ type: z.literal('switch'), props: draftPropsSchemas.switch, besidePrevious }),
    z.strictObject({ type: z.literal('badge'), props: draftPropsSchemas.badge, besidePrevious }),
    z.strictObject({ type: z.literal('divider'), props: draftPropsSchemas.divider, besidePrevious }),
    z.strictObject({ type: z.literal('link'), props: draftPropsSchemas.link, besidePrevious }),
    z.strictObject({ type: z.literal('select'), props: draftPropsSchemas.select, besidePrevious }),
    z.strictObject({ type: z.literal('radioGroup'), props: draftPropsSchemas.radioGroup, besidePrevious }),
    z.strictObject({ type: z.literal('contentCard'), props: draftPropsSchemas.contentCard, besidePrevious }),
    z.strictObject({ type: z.literal('paymentCard'), props: draftPropsSchemas.paymentCard, besidePrevious }),
    z.strictObject({ type: z.literal('progress'), props: draftPropsSchemas.progress, besidePrevious }),
    z.strictObject({ type: z.literal('dialog'), props: draftPropsSchemas.dialog, besidePrevious }),
    z.strictObject({ type: z.literal('flag'), props: draftPropsSchemas.flag, besidePrevious }),
    z.strictObject({ type: z.literal('footer'), props: draftPropsSchemas.footer, besidePrevious }),
  ])).max(MAX_SELECTIONS),
  unsupported: z.array(z.enum(UNSUPPORTED)).max(UNSUPPORTED.length),
});

// Unknown JS callers get the same non-executable, bounded JSON boundary as model JSON.
function boundedJson(input: unknown): boolean {
  const pending = [{ value: input, depth: 0 }];
  const seen = new Set<object>();
  let count = 0;
  try {
    while (pending.length) {
      const { value, depth } = pending.pop()!;
      if (++count > SPEC_LIMITS.maxJsonValues || depth > 6) return false;
      if (value === null || typeof value === 'boolean') continue;
      if (typeof value === 'number') { if (!Number.isFinite(value)) return false; continue; }
      if (typeof value === 'string') { if (value.length > SPEC_LIMITS.maxTextLength) return false; continue; }
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

export const selectionSchema = z.unknown().refine(boundedJson, { message: 'Expected bounded JSON selection data.' })
  .pipe(selectionStructureSchema.superRefine((selection, ctx) => {
    selection.components.forEach((component, index) => {
      if ((component.type === 'select' || component.type === 'radioGroup') && component.props.defaultValue !== undefined
        && !component.props.options.includes(component.props.defaultValue)) ctx.addIssue({ code: 'custom',
        path: ['components', index, 'props', 'defaultValue'], message: 'The default selection must be one of the options.' });
    });
    if (!selection.form.enabled && selection.form.label !== null) ctx.addIssue({ code: 'custom', path: ['form', 'label'], message: 'A disabled form must have a null label.' });
    if (!selection.unsupported.length && !selection.components.length) ctx.addIssue({ code: 'custom', path: ['components'], message: 'A supported selection must contain components.' });
    if (selection.components[0]?.besidePrevious) ctx.addIssue({ code: 'custom', path: ['components', 0, 'besidePrevious'], message: 'The first component has no previous component.' });
    if (new Set(selection.unsupported).size !== selection.unsupported.length) ctx.addIssue({ code: 'custom', path: ['unsupported'], message: 'Unsupported categories must be unique.' });
  }));
export type SelectionPoc = z.infer<typeof selectionSchema>;

export class SelectionPocError extends Error {
  constructor(readonly stage: 'selection_schema' | 'composition' | 'unsupported', readonly issues: readonly z.core.$ZodIssue[] = [],
    readonly unsupported: SelectionPoc['unsupported'] = []) {
    super('The isolated selection PoC could not produce a complete UI.');
  }
}

/** No prompt input: this function composes data, never recognizes form templates. */
export function compileSelectionPoc(input: unknown) {
  const parsed = selectionSchema.safeParse(input);
  if (!parsed.success) throw new SelectionPocError('selection_schema', parsed.error.issues);
  const selection = parsed.data;
  if (selection.unsupported.length) throw new SelectionPocError('unsupported', [], selection.unsupported);
  const blocks: DraftNode[] = [];
  selection.components.forEach((component, index) => {
    if (component.type === 'button' && component.props.type !== 'button' && !selection.form.enabled) {
      throw new SelectionPocError('composition', [{ code: 'custom', path: ['components', index, 'props', 'type'], message: 'Submit/reset buttons require a declared form.' }]);
    }
    const { besidePrevious: joinsPrevious, ...leaf } = component;
    if (!joinsPrevious) blocks.push(leaf);
    else {
      const previous = blocks.pop()!; // First-entry validation guarantees a preceding block.
      if (previous.type === 'horizontalLayout') { previous.children.push(leaf); blocks.push(previous); }
      else blocks.push({ type: 'horizontalLayout', props: { gap: 'medium' }, children: [previous, leaf] });
    }
  });
  let root: DraftNode = blocks.length === 1 ? blocks[0] : { type: 'verticalLayout', props: { gap: 'medium' }, children: blocks };
  if (selection.form.enabled) root = { type: 'form', props: { label: selection.form.label ?? DEFAULT_FORM_LABEL }, children: [root] };
  return compileModelUi({ irVersion: '1', status: 'supported', root });
}
