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

export const COMPONENT_TYPES = [
  'textInput', 'emailInput', 'passwordInput', 'checkbox', 'button',
  'text', 'heading', 'verticalLayout', 'horizontalLayout', 'form',
] as const;
export type ComponentType = typeof COMPONENT_TYPES[number];
const formChildren = COMPONENT_TYPES.filter(type => type !== 'form');

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
