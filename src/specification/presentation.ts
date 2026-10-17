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
    placeholder?: string; required?: boolean; disabled?: boolean; maxLength?: number;
  };
  Checkbox: { id: string; name: string; required?: boolean; disabled?: boolean };
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
