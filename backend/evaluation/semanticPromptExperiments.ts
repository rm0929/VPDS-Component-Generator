import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import baseline from './fixtures/semantic-baseline-prompt-v1.json';
import type { PromptMessage } from './evaluationProvider';
import { hash } from './metadata';

export const SEMANTIC_PROMPT_VARIANTS = ['baseline', 'ui-only-interpretation-v1'] as const;
export type SemanticPromptVariant = typeof SEMANTIC_PROMPT_VARIANTS[number];

// General interpretation policy only: no example requests, plans or label lookups.
export const UI_ONLY_INTERPRETATION = `UI-only interpretation policy:
This application generates UI components and their React TSX, not backend business logic. Your output is only SemanticUiPlan JSON; the application handles rendering and TSX generation later.
Button labels describe UI controls. They do not automatically request implementation of persistence, authentication, navigation or destructive actions. Native button, submit and reset semantics are supported UI properties; their presence is not a request for business logic.
Only explicitly requested essential functionality, components or properties outside the supported contract justify an unsupported outcome. Do not refuse a request for supported UI merely because its business effects are not implemented. If the user explicitly requires unsupported execution or side effects, return unsupported-behavior; if a required component/property is outside the catalog, return unsupported-component. Never silently omit those requirements or implement unsafe behavior.
Interpret the remaining instructions within this UI-only scope.`;

/** Manual experiments only. The active provider never imports this module. */
export function semanticExperimentMessages(variant: SemanticPromptVariant): PromptMessage[] {
  const messages = baseline.map(message => ({ ...message })) as PromptMessage[];
  if (variant === 'ui-only-interpretation-v1') messages[0].content = `${UI_ONLY_INTERPRETATION}\n\n${messages[0].content}`;
  return messages;
}

export function semanticSourceMetadata(root: string) {
  const files = ['backend/src/compileSemanticUiPlan.ts', 'backend/src/semanticUiPlan.ts'];
  const semanticCompilerHashes = Object.fromEntries(files.map(file => [file, hash(readFileSync(resolve(root, file), 'utf8'))]));
  return { semanticCompilerRevision: hash(JSON.stringify(semanticCompilerHashes)), semanticCompilerHashes };
}
