import { z } from 'zod';
import { componentRegistry, identifierSchema, SPEC_LIMITS } from './componentRegistry';
import type { ComponentType, UiNode } from './componentRegistry';

export const UI_SPEC_VERSION = '1.0' as const;

// Expand a finite schema rather than recursing into untrusted input indefinitely.
function nodeSchema(depth: number): z.ZodType<UiNode> {
  const children = z.array(depth < SPEC_LIMITS.maxDepth ? nodeSchema(depth + 1) : z.never())
    .min(1).max(SPEC_LIMITS.maxComponents);
  const node = <T extends ComponentType, P extends z.ZodType>(type: T, props: P) => z.strictObject({
    id: identifierSchema, type: z.literal(type), props,
  });
  return z.discriminatedUnion('type', [
    node('textInput', componentRegistry.textInput.propsSchema),
    node('emailInput', componentRegistry.emailInput.propsSchema),
    node('passwordInput', componentRegistry.passwordInput.propsSchema),
    node('checkbox', componentRegistry.checkbox.propsSchema),
    node('button', componentRegistry.button.propsSchema),
    node('text', componentRegistry.text.propsSchema),
    node('heading', componentRegistry.heading.propsSchema),
    node('verticalLayout', componentRegistry.verticalLayout.propsSchema).extend({ children }),
    node('horizontalLayout', componentRegistry.horizontalLayout.propsSchema).extend({ children }),
    node('form', componentRegistry.form.propsSchema).extend({ children }),
  ]);
}

// Reject non-JSON JS values and cycles before Zod clones/traverses the tree.
// The budget also bounds malformed inputs that do not resemble component nodes.
function isBoundedJson(input: unknown): boolean {
  const pending: { value: unknown; depth: number }[] = [{ value: input, depth: 0 }];
  const seen = new Set<object>();
  let visited = 0;
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    if (++visited > SPEC_LIMITS.maxJsonValues || depth > SPEC_LIMITS.maxDepth * 3 + 3) return false;
    if (value === null || typeof value === 'boolean') continue;
    if (typeof value === 'string') {
      if (value.length > SPEC_LIMITS.maxTextLength) return false;
      continue;
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return false;
      continue;
    }
    if (typeof value !== 'object' || seen.has(value)) return false;
    seen.add(value);
    if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false;
    const keys = Reflect.ownKeys(value);
    if (keys.length + pending.length > SPEC_LIMITS.maxJsonValues - visited) return false;
    for (const key of keys) {
      if (Array.isArray(value) && key === 'length') continue;
      if (typeof key !== 'string') return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (!descriptor.enumerable || !('value' in descriptor)) return false;
      pending.push({ value: descriptor.value, depth: depth + 1 });
    }
    if (Array.isArray(value) && keys.length !== value.length + 1) return false;
  }
  return true;
}

const documentSchema = z.strictObject({
  version: z.literal(UI_SPEC_VERSION),
  root: nodeSchema(1),
}).superRefine((spec, ctx) => {
  const ids = new Set<string>();
  const names = new Set<string>();
  let count = 0;
  const visit = (node: UiNode, path: (string | number)[], insideForm: boolean) => {
    if (++count > SPEC_LIMITS.maxComponents) {
      if (count === SPEC_LIMITS.maxComponents + 1) ctx.addIssue({ code: 'custom', path, message: `Maximum ${SPEC_LIMITS.maxComponents} components exceeded` });
      return;
    }
    if (ids.has(node.id)) ctx.addIssue({ code: 'custom', path: [...path, 'id'], message: 'Component IDs must be unique' });
    ids.add(node.id);
    if ('name' in node.props) {
      if (names.has(node.props.name)) ctx.addIssue({ code: 'custom', path: [...path, 'props', 'name'], message: 'Field names must be unique' });
      names.add(node.props.name);
    }
    if (node.type === 'form' && insideForm) ctx.addIssue({ code: 'custom', path, message: 'Forms cannot be nested, including through layouts' });
    if (node.type === 'button' && node.props.type !== 'button' && !insideForm) ctx.addIssue({ code: 'custom', path, message: 'Submit/reset buttons require a form ancestor' });
    if (node.children) {
      const allowed: readonly ComponentType[] = componentRegistry[node.type].allowedChildren;
      node.children.forEach((child, index) => {
        const childPath = [...path, 'children', index];
        if (!allowed.includes(child.type)) ctx.addIssue({ code: 'custom', path: childPath, message: `${child.type} is not permitted inside ${node.type}` });
        visit(child, childPath, insideForm || node.type === 'form');
      });
    }
  };
  visit(spec.root, ['root'], false);
});

/** The public validation boundary: pass JSON.parse output or other unknown data. */
export const uiSpecificationSchema = z.unknown().refine(isBoundedJson, {
  message: 'Expected bounded JSON data without cycles, shared references, accessors, or non-JSON values',
}).pipe(documentSchema);

export type UiSpecification = z.infer<typeof uiSpecificationSchema>;
