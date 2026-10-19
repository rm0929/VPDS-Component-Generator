import baseline from './fixtures/baseline-prompt-v1.json';
import { modelUiDraftSchema } from '../src/modelUiDraft';
import type { PromptMessage } from './evaluationProvider';
import { CONCISE_PROMPT } from './concisePrompt';

export const PROMPT_VARIANTS = ['baseline', 'deduplicated', 'layout', 'examples', 'negation', 'concise-v1'] as const;
export type PromptVariant = typeof PROMPT_VARIANTS[number];

const layoutGuidance = `Layout composition:
A horizontalLayout arranges its direct children side by side; a verticalLayout stacks its direct children from top to bottom. Use these relationships deliberately.
Inputs and checkboxes are atomic controls: the trusted renderer already supplies their labels and input presentation wrappers. Do not wrap each field in its own layout or add text nodes just to label it.
Use the smallest tree that preserves every requested component, order, gap, and meaningful grouping. Avoid redundant single-child layouts and repeated same-direction wrappers. Nested rows inside columns are appropriate when they express distinct groups.
A request for one form should normally have a form root. A form can directly contain controls or a layout; no outer layout is required. Keep submit/reset actions inside that form.
For side-by-side fields, put both controls directly in the same horizontalLayout. An item below that group belongs after the whole row, outside it. Do not place related controls in separate one-child rows.`;

const negationGuidance = `Positive and negative requirements:
Retain ALL positively requested components and relationships. An exclusion removes only its specific prohibited items; it does not cancel the rest of the request.
Interpret do not, without, and exclude with their stated scope. A request for UI only, without real authentication or network requests, asks for supported UI; it is not a request to implement those behaviors.
Before responding, silently verify the positive requirements and the exclusions separately. Return only draft JSON, never this checklist or reasoning. A control's label is not a substitute for the requested component type.`;

// These developer-authored demonstrations are distinct from every evaluation prompt.
const examples = [
  { request: 'Place a Ready paragraph beside an ordinary Inspect button.', root: {
    type: 'horizontalLayout', props: { gap: 'small' }, children: [
      { type: 'text', props: { content: 'Ready' } }, { type: 'button', props: { label: 'Inspect', type: 'button' } },
    ],
  } },
  { request: 'Create a workspace form with Region and Zone text fields side by side, followed by an Apply submit button.', root: {
    type: 'form', props: { label: 'Workspace' }, children: [{ type: 'verticalLayout', props: { gap: 'medium' }, children: [
      { type: 'horizontalLayout', props: { gap: 'small' }, children: [
        { type: 'textInput', props: { label: 'Region' } }, { type: 'textInput', props: { label: 'Zone' } },
      ] }, { type: 'button', props: { label: 'Apply', type: 'submit' } },
    ] }],
  } },
  { request: 'Create an alert preferences form with a Device text field and an Enable alerts checkbox. Exclude password fields and headings.', root: {
    type: 'form', props: { label: 'Alert preferences' }, children: [{ type: 'verticalLayout', props: { gap: 'medium' }, children: [
      { type: 'textInput', props: { label: 'Device' } }, { type: 'checkbox', props: { label: 'Enable alerts', required: false } },
    ] }],
  } },
];

/** Isolated changes from the same frozen baseline; never inspect a user prompt. */
export function experimentMessages(variant: PromptVariant): PromptMessage[] {
  if (variant === 'concise-v1') return [{ role: 'system', content: CONCISE_PROMPT }];
  const messages = baseline.map(item => ({ ...item })) as PromptMessage[];
  if (variant === 'deduplicated') {
    const content = messages[0].content;
    const start = content.indexOf('Complete worked example');
    const end = content.indexOf('Non-form example:', start);
    if (start < 0 || end < 0) throw new Error('Frozen example boundaries missing');
    messages[0].content = content.slice(0, start) + content.slice(end);
  }
  if (variant === 'layout') messages[0].content += `\n${layoutGuidance}`;
  if (variant === 'negation') messages[0].content += `\n${negationGuidance}`;
  if (variant === 'examples') {
    for (const example of examples) {
      messages.push({ role: 'user', content: example.request }, { role: 'assistant',
        content: JSON.stringify(modelUiDraftSchema.parse({ irVersion: '1', status: 'supported', root: example.root })) });
    }
  }
  return messages;
}
