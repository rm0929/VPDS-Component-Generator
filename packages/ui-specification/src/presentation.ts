import { uiSpecificationSchema } from './uiSpecification';
import type { UiSpecification } from './uiSpecification';
import type { UiNode } from './componentRegistry';

const gaps = { none: 0, small: 8, medium: 16, large: 24 } as const;
const headings = {
  1: { tag: 'h1', variant: 'headline-1' },
  2: { tag: 'h2', variant: 'headline-2' },
  3: { tag: 'h3', variant: 'headline-3' },
  4: { tag: 'h4', variant: 'headline-4' },
} as const;

export type DialogPresentationProps = { id: string; title: string; content: string; triggerLabel: string; closeLabel: string };
export type FlagPresentationProps = { id: string; content: string; title?: string;
  variant: 'information' | 'success' | 'warning' | 'error' | 'subtle'; dismissible: boolean };

// Internal, closed presentation vocabulary shared by preview and serialization.
// These are freshly constructed allowlisted props, never raw spec props.
type PresentationProps = {
  Utility: {
    id?: string; vFlex: true; vFlexCol?: true; vFlexRow?: true;
    vAlignItems?: 'center'; vGap: typeof gaps[keyof typeof gaps];
  };
  Label: { htmlFor: string };
  InputContainer: Record<string, never>;
  Input: {
    id: string; name: string; type: 'text' | 'email' | 'password';
    placeholder?: string; required?: boolean; disabled?: boolean; maxLength?: number; autoComplete?: 'off';
    inputMode?: 'numeric'; 'aria-describedby'?: string;
  };
  Checkbox: { id: string; name: string; required?: boolean; disabled?: boolean };
  Textarea: { id: string; name: string; placeholder?: string; required?: boolean; disabled?: boolean; maxLength?: number; rows?: number };
  Switch: { id: string; name: string; disabled?: boolean; defaultChecked?: boolean };
  SwitchLabel: { htmlFor: string };
  Badge: { id: string; badgeType?: 'critical' | 'neutral' | 'stable' | 'subtle' | 'warning' };
  Divider: { id: string; dividerType?: 'decorative' | 'section' };
  Link: { id: string; href: string };
  Select: { id: string; name: string; required?: boolean; disabled?: boolean; defaultValue?: string };
  option: { value: string };
  fieldset: { id: string; disabled?: boolean };
  legend: Record<string, never>;
  Radio: { id: string; name: string; value: string; required?: boolean; disabled?: boolean; defaultChecked?: boolean };
  ContentCard: { id: string };
  ContentCardBody: Record<string, never>;
  ContentCardTitle: { tag: 'h2' | 'h3' | 'h4'; variant: 'headline-2' | 'headline-3' | 'headline-4' };
  InputControl: Record<string, never>;
  VisaCardGenericLow: { 'aria-hidden': true; focusable: false };
  details: Record<string, never>;
  summary: Record<string, never>;
  Footer: { id: string };
  nav: { 'aria-label': string };
  ul: Record<string, never>;
  li: Record<string, never>;
  DialogExample: DialogPresentationProps;
  FlagExample: FlagPresentationProps;
  ProgressLinear: { id: string; max: 100; value?: number; paused?: boolean };
  ProgressLabel: { htmlFor: string };
  Button: { id: string; type: 'button' | 'submit' | 'reset'; disabled?: boolean };
  Typography: {
    id: string; tag: 'p' | 'h1' | 'h2' | 'h3' | 'h4';
    variant: 'body-1' | 'headline-1' | 'headline-2' | 'headline-3' | 'headline-4';
  };
  form: { id: string; 'aria-label': string };
};

export type PresentationTag = keyof PresentationProps;
export type PresentationElement = {
  [T in PresentationTag]: {
    tag: T;
    props: PresentationProps[T];
    children: (PresentationElement | string)[];
  };
}[PresentationTag];

function mapNode(node: UiNode): PresentationElement {
  switch (node.type) {
    case 'textInput':
    case 'emailInput':
    case 'passwordInput': {
      const { name, label, placeholder, required, disabled, maxLength } = node.props;
      const inputType = { textInput: 'text', emailInput: 'email', passwordInput: 'password' } as const;
      return {
        tag: 'Utility', props: { vFlex: true, vFlexCol: true, vGap: 8 },
        children: [
          { tag: 'Label', props: { htmlFor: node.id }, children: [label] },
          { tag: 'InputContainer', props: {}, children: [{
            tag: 'Input',
            props: { id: node.id, name, type: inputType[node.type], placeholder, required, disabled, maxLength },
            children: [],
          }] },
        ],
      };
    }
    case 'checkbox':
      return {
        tag: 'Utility', props: { vFlex: true, vAlignItems: 'center', vGap: 8 },
        children: [
          { tag: 'Checkbox', props: { id: node.id, name: node.props.name, required: node.props.required, disabled: node.props.disabled }, children: [] },
          { tag: 'Label', props: { htmlFor: node.id }, children: [node.props.label] },
        ],
      };
    case 'textarea': {
      const { name, label, placeholder, required, disabled, maxLength, rows } = node.props;
      return {
        tag: 'Utility', props: { vFlex: true, vFlexCol: true, vGap: 8 },
        children: [
          { tag: 'Label', props: { htmlFor: node.id }, children: [label] },
          { tag: 'InputContainer', props: {}, children: [{ tag: 'Textarea',
            props: { id: node.id, name, placeholder, required, disabled, maxLength, rows }, children: [] }] },
        ],
      };
    }
    case 'switch':
      return {
        tag: 'Utility', props: { vFlex: true, vAlignItems: 'center', vGap: 8 },
        children: [
          { tag: 'Switch', props: { id: node.id, name: node.props.name,
            disabled: node.props.disabled, defaultChecked: node.props.defaultChecked }, children: [] },
          { tag: 'SwitchLabel', props: { htmlFor: node.id }, children: [node.props.label] },
        ],
      };
    case 'badge':
      return { tag: 'Badge', props: { id: node.id, badgeType: node.props.badgeType }, children: [node.props.content] };
    case 'divider':
      return { tag: 'Divider', props: { id: node.id, dividerType: node.props.dividerType }, children: [] };
    case 'link':
      return { tag: 'Link', props: { id: node.id, href: node.props.href }, children: [node.props.label] };
    case 'select': {
      const { label, name, required, disabled, defaultValue, options } = node.props;
      return { tag: 'Utility', props: { vFlex: true, vFlexCol: true, vGap: 8 }, children: [
        { tag: 'Label', props: { htmlFor: node.id }, children: [label] },
        { tag: 'InputContainer', props: {}, children: [{ tag: 'Select',
          props: { id: node.id, name, required, disabled, defaultValue },
          children: options.map(value => ({ tag: 'option', props: { value }, children: [value] })) }] },
      ] };
    }
    case 'radioGroup': {
      const { label, name, options, defaultValue, required, disabled } = node.props;
      return { tag: 'fieldset', props: { id: node.id, disabled }, children: [
        { tag: 'legend', props: {}, children: [label] },
        ...options.map((value, index): PresentationElement => {
          const id = `${node.id}--option-${index}`;
          return { tag: 'Utility', props: { vFlex: true, vAlignItems: 'center', vGap: 8 }, children: [
            { tag: 'Radio', props: { id, name, value, required, disabled,
              defaultChecked: defaultValue === undefined ? undefined : value === defaultValue }, children: [] },
            { tag: 'Label', props: { htmlFor: id }, children: [value] },
          ] };
        }),
      ] };
    }
    case 'contentCard': {
      const { title, description, action } = node.props;
      const children: PresentationElement[] = [
        { tag: 'ContentCardTitle', props: headings[node.props.headingLevel ?? 3], children: [title] },
        { tag: 'Typography', props: { id: `${node.id}--description`, tag: 'p', variant: 'body-1' }, children: [description] },
      ];
      if (action) children.push(action.href !== undefined
        ? { tag: 'Link', props: { id: `${node.id}--action`, href: action.href }, children: [action.label] }
        : { tag: 'Button', props: { id: `${node.id}--action`, type: 'button' }, children: [action.label] });
      return { tag: 'ContentCard', props: { id: node.id }, children: [{ tag: 'ContentCardBody', props: {}, children }] };
    }
    case 'paymentCard': {
      const { name, label, includeCardholder, required, disabled } = node.props;
      const fields: { key: string; label: string; type: 'text' | 'password' }[] = [
        ...(includeCardholder ? [{ key: 'cardholder', label: 'Cardholder name', type: 'text' as const }] : []),
        { key: 'number', label: 'Card number', type: 'text' },
        { key: 'expiry', label: 'Expiry (MM/YY)', type: 'text' },
        { key: 'security-code', label: 'Security code', type: 'password' },
      ];
      return { tag: 'fieldset', props: { id: node.id, disabled }, children: [
        { tag: 'legend', props: {}, children: [label] },
        ...fields.map((field): PresentationElement => {
          const id = `${node.id}--${field.key}`;
          return { tag: 'Utility', props: { vFlex: true, vFlexCol: true, vGap: 8 }, children: [
            { tag: 'Label', props: { htmlFor: id }, children: [field.label] },
            // Brackets namespace composite names; model-owned field names cannot contain them.
            { tag: 'InputContainer', props: {}, children: [{ tag: 'Input', props: {
              id, name: `${name}[${field.key}]`, type: field.type, required, disabled, autoComplete: 'off',
              inputMode: field.key === 'number' || field.key === 'security-code' ? 'numeric' : undefined,
              placeholder: field.key === 'expiry' ? 'MM/YY' : undefined,
              'aria-describedby': field.key === 'security-code' ? `${node.id}--security-help` : undefined,
            }, children: [] }, ...(field.key === 'number' ? [{ tag: 'InputControl', props: {}, children: [
              { tag: 'VisaCardGenericLow', props: { 'aria-hidden': true, focusable: false }, children: [] },
            ] } satisfies PresentationElement] : [])] },
          ] };
        }),
        { tag: 'details', props: {}, children: [
          { tag: 'summary', props: {}, children: ['About the security code'] },
          { tag: 'Typography', props: { id: `${node.id}--security-help`, tag: 'p', variant: 'body-1' },
            children: ['Security codes have three or four digits. Use synthetic values in this example.'] },
        ] },
        { tag: 'Typography', props: { id: `${node.id}--notice`, tag: 'p', variant: 'body-1' },
          children: ['UI example only. No card validation or payment processing.'] },
      ] };
    }
    case 'dialog':
      return { tag: 'DialogExample', props: { id: node.id, title: node.props.title,
        content: node.props.content ?? 'Example dialog. No changes are submitted.',
        triggerLabel: node.props.triggerLabel ?? `Open ${node.props.title}`, closeLabel: node.props.closeLabel ?? 'Close' }, children: [] };
    case 'flag':
      return { tag: 'FlagExample', props: { id: node.id, content: node.props.content, title: node.props.title,
        variant: node.props.variant ?? 'information', dismissible: node.props.dismissible ?? false }, children: [] };
    case 'footer':
      return { tag: 'Footer', props: { id: node.id }, children: [
        { tag: 'Utility', props: { vFlex: true, vFlexCol: true, vGap: 8 }, children: [
          { tag: 'Typography', props: { id: `${node.id}--text`, tag: 'p', variant: 'body-1' }, children: [node.props.text] },
          ...(node.props.links?.length ? [{ tag: 'nav', props: { 'aria-label': 'Footer links' }, children: [
            { tag: 'ul', props: {}, children: node.props.links.map((link, index) => ({ tag: 'li', props: {}, children: [
              { tag: 'Link', props: { id: `${node.id}--link-${index}`, href: link.href }, children: [link.label] },
            ] })) },
          ] } satisfies PresentationElement] : []),
        ] },
      ] };
    case 'progress':
      return { tag: 'Utility', props: { vFlex: true, vFlexCol: true, vGap: 8 }, children: [
        { tag: 'ProgressLabel', props: { htmlFor: node.id }, children: [node.props.label] },
        { tag: 'ProgressLinear', props: { id: node.id, max: 100, paused: node.props.paused,
          value: node.props.mode === 'determinate' ? node.props.value : undefined }, children: [] },
      ] };
    case 'button':
      return {
        tag: 'Button', props: { id: node.id, type: node.props.type, disabled: node.props.disabled },
        children: [node.props.label],
      };
    case 'text':
      return { tag: 'Typography', props: { id: node.id, tag: 'p', variant: 'body-1' }, children: [node.props.content] };
    case 'heading':
      return { tag: 'Typography', props: { id: node.id, ...headings[node.props.level] }, children: [node.props.content] };
    case 'verticalLayout':
      return {
        tag: 'Utility', props: { id: node.id, vFlex: true, vFlexCol: true, vGap: gaps[node.props.gap ?? 'medium'] },
        children: node.children.map(mapNode),
      };
    case 'horizontalLayout':
      return {
        tag: 'Utility', props: { id: node.id, vFlex: true, vFlexRow: true, vGap: gaps[node.props.gap ?? 'medium'] },
        children: node.children.map(mapNode),
      };
    case 'form':
      return { tag: 'form', props: { id: node.id, 'aria-label': node.props.label }, children: node.children.map(mapNode) };
    default: {
      const unsupported: never = node;
      throw new Error(`Unsupported component: ${String(unsupported)}`);
    }
  }
}

/** Revalidate at each public consumer boundary, including forged or mutated TS data. */
export function buildPresentation(specification: UiSpecification): PresentationElement {
  return mapNode(uiSpecificationSchema.parse(specification).root);
}
