import type { z } from 'zod';
import { uiSpecificationSchema, UI_SPEC_VERSION } from '../../src/specification/uiSpecification';
import type { UiSpecification } from '../../src/specification/uiSpecification';
import { modelUiDraftSchema } from './modelUiDraft';
import type { DraftNode } from './modelUiDraft';

export class ModelUiCompilationError extends Error {
  constructor(readonly stage: 'model_draft' | 'ui_schema' | 'unsupported_request',
    readonly issues: readonly z.core.$ZodIssue[] = []) {
    super('The model draft could not be compiled.');
  }
}

/** Pure compiler: identity is generated; UI semantics are copied without repair. */
export function compileModelUi(input: unknown): UiSpecification {
  const draft = modelUiDraftSchema.safeParse(input);
  if (!draft.success) throw new ModelUiCompilationError('model_draft', draft.error.issues);
  if (draft.data.status === 'unsupported') throw new ModelUiCompilationError('unsupported_request');
  const names = new Set<string>();
  const fieldName = (label: string): string => {
    let base = label.normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!base) base = 'field';
    if (!/^[a-z]/.test(base)) base = `field-${base}`;
    base = base.slice(0, 64).replace(/-+$/g, '');
    let name = base;
    for (let index = 2; names.has(name); index++) {
      const suffix = `-${index}`;
      name = base.slice(0, 64 - suffix.length).replace(/-+$/g, '') + suffix;
    }
    names.add(name);
    return name;
  };
  const visit = (node: DraftNode, position: string): unknown => {
    const props = node.type === 'textInput' || node.type === 'emailInput' || node.type === 'passwordInput' || node.type === 'checkbox'
      ? { ...node.props, name: fieldName(node.props.label) } : { ...node.props };
    return { id: `node-${position}`, type: node.type, props,
      ...(node.children ? { children: node.children.map((child, index) => visit(child, `${position}-${index}`)) } : {}),
    };
  };
  const compiled = uiSpecificationSchema.safeParse({ version: UI_SPEC_VERSION, root: visit(draft.data.root, '0') });
  if (!compiled.success) throw new ModelUiCompilationError('ui_schema', compiled.error.issues);
  return compiled.data;
}
