import type { z } from 'zod';
import type { UiSpecification } from '@vpds/ui-specification/uiSpecification';
import { compileModelUi } from '../compileModelUi';
import { UI_DRAFT_VERSION } from '../modelUiDraft';
import type { DraftNode } from '../modelUiDraft';
import { semanticUiPlanSchema } from './semanticUiPlan';
import type { SemanticUiReference } from './semanticUiPlan';

export class SemanticUiPlanCompilationError extends Error {
  readonly stage = 'semantic_plan' as const;
  constructor(readonly issues: readonly z.core.$ZodIssue[]) {
    super('The semantic UI plan could not be compiled.');
  }
}

/** One lossless composition pass, followed by the existing identity/validation compiler. */
export function compileSemanticUiPlan(input: unknown): UiSpecification {
  const parsed = semanticUiPlanSchema.safeParse(input);
  if (!parsed.success) throw new SemanticUiPlanCompilationError(parsed.error.issues);
  const plan = parsed.data;
  if (plan.status === 'unsupported') {
    // Keep the existing unsupported-request outcome; never turn a refusal into UI.
    return compileModelUi({ irVersion: UI_DRAFT_VERSION, status: 'unsupported', reason: plan.reason });
  }
  const compose = (ref: SemanticUiReference): DraftNode => {
    if ('element' in ref) return plan.elements[ref.element];
    const group = plan.groups[ref.group];
    const children = group.members.map(compose);
    switch (group.kind) {
      case 'row': return { type: 'horizontalLayout', props: group.props, children };
      case 'column': return { type: 'verticalLayout', props: group.props, children };
      case 'form': return { type: 'form', props: group.props, children };
      default: {
        const unsupported: never = group;
        throw new Error(`Unsupported semantic group: ${String(unsupported)}`);
      }
    }
  };
  const children = plan.content.map(compose);
  const root: DraftNode = children.length === 1 ? children[0] : { type: 'verticalLayout', props: {}, children };
  return compileModelUi({ irVersion: UI_DRAFT_VERSION, status: 'supported', root });
}
