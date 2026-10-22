import { z } from 'zod';

export const SPEC_LIMITS = Object.freeze({
  maxDepth: 6, maxComponents: 100, maxTextLength: 1000, maxJsonValues: 4096,
});

export const identifierSchema = z.string().min(1).max(64)
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, 'Use lowercase letters, digits, and single hyphens; start with a letter');

// A deliberately small literal-text language: no markup or expression delimiters.
const text = z.string().min(1).max(SPEC_LIMITS.maxTextLength)
  .refine(value => value.trim().length > 0, 'Text must not be blank')
  .refine(value => !/[<>`{}]|=>/.test(value), 'Markup and expression delimiters are not allowed');
const label = text.max(200);
const inputProps = z.strictObject({
  name: identifierSchema,
  label,
  placeholder: label.optional(),
  required: z.boolean().optional(),
  disabled: z.boolean().optional(),
  maxLength: z.number().int().min(1).max(1000).optional(),
});
const layoutProps = z.strictObject({ gap: z.enum(['none', 'small', 'medium', 'large']).optional() });

// Preserve the older draft/semantic workflows' benchmarked vocabulary.
export const BASE_COMPONENT_TYPES = [
  'textInput', 'emailInput', 'passwordInput', 'checkbox', 'button',
  'text', 'heading', 'verticalLayout', 'horizontalLayout', 'form',
] as const;
export const COMPONENT_TYPES = [...BASE_COMPONENT_TYPES, 'textarea', 'switch', 'badge', 'divider', 'link',
  'select', 'radioGroup', 'contentCard', 'paymentCard', 'progress', 'dialog', 'flag', 'footer'] as const;
export type ComponentType = typeof COMPONENT_TYPES[number];
const formChildren = COMPONENT_TYPES.filter(type => type !== 'form');

// URLs are destinations, never executable expressions. Do not trim or repair
// model data: browser URL parsing can otherwise conceal a scheme or authority.
export const linkDestinationSchema = z.string().min(1).max(1000).refine(value => {
  if (/[\s\\<>`{}]/u.test(value) || value.startsWith('//')
    || Array.from(value).some(character => character.charCodeAt(0) < 32
      || (character.charCodeAt(0) >= 127 && character.charCodeAt(0) <= 159))) return false;
  const scheme = /^[a-z][a-z0-9+.-]*:/i.exec(value);
  if (scheme && !/^https?:\/\//i.test(value)) return false;
  try {
    const url = new URL(value, 'https://preview.invalid/');
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}, 'Link destinations must be HTTP(S) URLs or relative references without credentials or whitespace.');

const choiceProps = (minimum: number) => z.strictObject({
  name: identifierSchema, label,
  options: z.array(label).min(minimum).max(20).refine(values => new Set(values).size === values.length, 'Options must be unique.'),
  defaultValue: label.optional(), required: z.boolean().optional(), disabled: z.boolean().optional(),
});

type RegistryEntry = {
  propsSchema: z.ZodType;
  allowedChildren: readonly ComponentType[];
  // Descriptive mapping only. No component instances, callbacks, or source code.
  mapping: { elements: readonly string[]; documentation: string };
};

const inputMapping = {
  elements: ['Label', 'InputContainer', 'Input'],
  documentation: 'https://design.visa.com/react/components/input',
} as const;

export const componentRegistry = {
  textInput: { propsSchema: inputProps, allowedChildren: [], mapping: inputMapping },
  emailInput: { propsSchema: inputProps, allowedChildren: [], mapping: inputMapping },
  passwordInput: { propsSchema: inputProps, allowedChildren: [], mapping: inputMapping },
  checkbox: {
    propsSchema: z.strictObject({ name: identifierSchema, label, required: z.boolean().optional(), disabled: z.boolean().optional() }),
    allowedChildren: [],
    mapping: { elements: ['Checkbox', 'Label'], documentation: 'https://design.visa.com/react/components/checkbox' },
  },
  button: {
    propsSchema: z.strictObject({ label, type: z.enum(['button', 'submit', 'reset']), disabled: z.boolean().optional() }),
    allowedChildren: [],
    mapping: { elements: ['Button'], documentation: 'https://design.visa.com/react/components/button' },
  },
  text: {
    propsSchema: z.strictObject({ content: text }), allowedChildren: [],
    mapping: { elements: ['Typography'], documentation: 'https://design.visa.com/react/components/typography' },
  },
  heading: {
    propsSchema: z.strictObject({ content: text, level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]) }),
    allowedChildren: [],
    mapping: { elements: ['Typography'], documentation: 'https://design.visa.com/react/components/typography' },
  },
  textarea: {
    propsSchema: inputProps.extend({ rows: z.number().int().min(1).max(20).optional() }), allowedChildren: [],
    mapping: { elements: ['Label', 'InputContainer', 'Textarea'], documentation: 'https://design.visa.com/components/input/?code_library=react' },
  },
  switch: {
    propsSchema: z.strictObject({ name: identifierSchema, label, disabled: z.boolean().optional(), defaultChecked: z.boolean().optional() }),
    allowedChildren: [],
    mapping: { elements: ['Switch', 'SwitchLabel'], documentation: 'https://design.visa.com/components/switch/?code_library=react' },
  },
  badge: {
    propsSchema: z.strictObject({ content: label, badgeType: z.enum(['critical', 'neutral', 'stable', 'subtle', 'warning']).optional() }),
    allowedChildren: [],
    mapping: { elements: ['Badge'], documentation: 'https://design.visa.com/components/badge/?code_library=react' },
  },
  divider: {
    propsSchema: z.strictObject({ dividerType: z.enum(['decorative', 'section']).optional() }), allowedChildren: [],
    mapping: { elements: ['Divider'], documentation: 'https://design.visa.com/components/divider/?code_library=react' },
  },
  link: {
    propsSchema: z.strictObject({ label, href: linkDestinationSchema }), allowedChildren: [],
    mapping: { elements: ['Link'], documentation: 'https://design.visa.com/components/link/?code_library=react' },
  },
  select: {
    propsSchema: choiceProps(1), allowedChildren: [],
    mapping: { elements: ['Label', 'InputContainer', 'Select'], documentation: 'https://design.visa.com/components/select/?code_library=react' },
  },
  radioGroup: {
    propsSchema: choiceProps(2), allowedChildren: [],
    mapping: { elements: ['Radio', 'Label'], documentation: 'https://design.visa.com/components/radio/?code_library=react' },
  },
  contentCard: {
    propsSchema: z.strictObject({ title: label, description: text,
      headingLevel: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
      action: z.strictObject({ label, href: linkDestinationSchema.optional() }).optional() }),
    allowedChildren: [],
    mapping: { elements: ['ContentCard', 'ContentCardBody', 'ContentCardTitle', 'Typography', 'Button', 'Link'], documentation: 'https://design.visa.com/components/content-card/?code_library=react' },
  },
  paymentCard: {
    propsSchema: z.strictObject({ name: identifierSchema, label, includeCardholder: z.boolean().optional(),
      required: z.boolean().optional(), disabled: z.boolean().optional() }), allowedChildren: [],
    mapping: { elements: ['Label', 'InputContainer', 'Input', 'InputControl', 'VisaCardGenericLow', 'Utility'], documentation: 'https://design.visa.com/patterns/card-input/' },
  },
  progress: {
    propsSchema: z.discriminatedUnion('mode', [
      z.strictObject({ label, mode: z.literal('determinate'), value: z.number().min(0).max(100), paused: z.boolean().optional() }),
      z.strictObject({ label, mode: z.literal('indeterminate'), paused: z.boolean().optional() }),
    ]), allowedChildren: [],
    mapping: { elements: ['ProgressLinear', 'ProgressLabel'], documentation: 'https://design.visa.com/components/progress/?code_library=react' },
  },
  dialog: {
    propsSchema: z.strictObject({ title: label, content: text.optional(), triggerLabel: label.optional(), closeLabel: label.optional() }),
    allowedChildren: [],
    mapping: { elements: ['Dialog', 'DialogHeader', 'DialogContent', 'Button', 'useFocusTrap'], documentation: 'https://design.visa.com/components/dialog/' },
  },
  flag: {
    propsSchema: z.strictObject({ content: text, title: label.optional(),
      variant: z.enum(['information', 'success', 'warning', 'error', 'subtle']).optional(), dismissible: z.boolean().optional() }),
    allowedChildren: [],
    mapping: { elements: ['Flag', 'FlagContent', 'MessageIcon', 'FlagCloseButton'], documentation: 'https://design.visa.com/components/flag/' },
  },
  footer: {
    propsSchema: z.strictObject({ text, links: z.array(z.strictObject({ label, href: linkDestinationSchema })).max(8).optional() }),
    allowedChildren: [],
    mapping: { elements: ['Footer', 'Typography', 'Link'], documentation: 'https://design.visa.com/components/footer/' },
  },
  verticalLayout: {
    propsSchema: layoutProps, allowedChildren: COMPONENT_TYPES,
    mapping: { elements: ['Utility'], documentation: 'https://design.visa.com/react/utilities/api' },
  },
  horizontalLayout: {
    propsSchema: layoutProps, allowedChildren: COMPONENT_TYPES,
    mapping: { elements: ['Utility'], documentation: 'https://design.visa.com/react/utilities/api' },
  },
  form: {
    propsSchema: z.strictObject({ label }), allowedChildren: formChildren,
    mapping: { elements: ['form'], documentation: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form' },
  },
} as const satisfies Record<ComponentType, RegistryEntry>;

export type ComponentProps<T extends ComponentType> = z.infer<typeof componentRegistry[T]['propsSchema']>;
export type ContainerType = 'verticalLayout' | 'horizontalLayout' | 'form';
interface ContainerChildren { children: UiNode[] }
export type UiNode = {
  [T in ComponentType]: { id: string; type: T; props: ComponentProps<T> }
    & (T extends ContainerType ? ContainerChildren : { children?: never });
}[ComponentType];
