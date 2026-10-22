import type { z } from 'zod';

const stageMessages = {
  ollama_response_json: 'The Ollama HTTP body is not valid JSON or UTF-8.',
  ollama_envelope: 'The Ollama response envelope failed validation.',
  model_json: 'The model message is not valid JSON.',
  model_draft: 'The model draft failed internal contract validation.',
  semantic_plan: 'The semantic UI plan failed shape or relationship validation.',
  selection_schema: 'The flat component selection failed contract validation.',
  composition: 'The flat component selection failed composition validation.',
  unsupported_request: 'The model reported an unsupported UI request.',
  ui_schema: 'The model document failed authoritative UI validation.',
  requirement_coverage: 'The validated UI is missing recognized requirements.',
} as const;
type FailureStage = keyof typeof stageMessages;

const issueMessages = {
  invalid_type: 'A value has the wrong type or a required property is missing.',
  invalid_value: 'A value is outside the permitted contract values.',
  invalid_union: 'The data does not match a permitted component or property variant.',
  invalid_format: 'A value does not match its required format.',
  not_multiple_of: 'A number violates a permitted step size.',
  invalid_key: 'A record key violates the contract.',
  invalid_element: 'A collection element violates the contract.',
  too_small: 'A value is shorter or smaller than the permitted minimum.',
  too_big: 'A value exceeds a contract limit.',
  unrecognized_keys: 'An object contains unsupported properties.',
  custom: 'A UI contract rule was violated.',
} as const;
const customMessages = new Map([
  ['Component IDs must be unique', 'Component IDs must be unique.'],
  ['Field names must be unique', 'Field names must be unique.'],
  ['Forms cannot be nested, including through layouts', 'Forms cannot be nested.'],
  ['Submit/reset buttons require a form ancestor', 'Submit/reset buttons require a form ancestor.'],
  ...[
    'Expected bounded JSON semantic plan data.',
    'The composed UI exceeds the component limit, including its implicit root.',
    'The reference index is outside its declared array.',
    'Every element and group must have exactly one reference.',
    'Groups must not form cycles.',
    'The composed UI exceeds the nesting limit.',
    'Submit/reset buttons require explicit form membership.',
    'Form groups cannot be nested.',
    'Expected bounded JSON selection data.',
    'A supported selection must contain components.',
    'The first component has no previous component.',
    'Unsupported categories must be unique.',
    'Submit/reset buttons require a declared form.',
    'A disabled form must have a null label.',
  ].map(message => [message, message] as const),
]);
// Issue paths can contain model-owned keys. Never print arbitrary path segments.
const pathKeys = new Set(['irVersion', 'status', 'reason', 'version', 'root', 'id', 'type', 'props', 'children', 'name', 'label',
  'placeholder', 'required', 'disabled', 'maxLength', 'content', 'level', 'gap', 'headingLevel', 'triggerLabel', 'closeLabel', 'variant', 'dismissible', 'text', 'links', 'options', 'defaultValue', 'title', 'description', 'action', 'includeCardholder', 'mode', 'value', 'paused', 'rows', 'defaultChecked', 'badgeType', 'dividerType', 'href',
  'done', 'done_reason', 'message', 'role', 'planVersion', 'elements', 'groups', 'kind', 'members', 'element', 'group',
  'form', 'enabled', 'components', 'besidePrevious', 'unsupported']);

export type DiagnosticEntry = {
  stage: FailureStage; message: string;
  issues: { path: (string | number)[]; code: string; message: string }[];
};
export type GenerationDiagnostics = (stage: FailureStage, issues?: readonly z.core.$ZodIssue[]) => void;

/** Opt-in stderr metadata for local development; no raw errors, messages, or values. */
export function createGenerationDiagnostics(
  environment: NodeJS.ProcessEnv = process.env,
  sink: (entry: DiagnosticEntry) => void = entry => console.error(JSON.stringify(entry)),
): GenerationDiagnostics {
  if (environment.NODE_ENV !== 'development' || environment.API_LOCAL_DIAGNOSTICS !== 'true') return () => {};
  return (stage, issues = []) => {
    try {
      sink({ stage, message: stageMessages[stage], issues: issues.slice(0, 20).map(issue => {
        const code = Object.hasOwn(issueMessages, issue.code) ? issue.code as keyof typeof issueMessages : 'custom';
        return {
          path: issue.path.slice(0, 24).map(key => typeof key === 'number'
            ? (Number.isInteger(key) && key >= 0 && key <= 1000 ? key : '[redacted]')
            : (typeof key === 'string' && pathKeys.has(key) ? key : '[redacted]')),
          code,
          message: code === 'custom' ? (customMessages.get(issue.message) ?? issueMessages.custom) : issueMessages[code],
        };
      }) });
    } catch { /* Diagnostics must never change application behavior. */ }
  };
}
