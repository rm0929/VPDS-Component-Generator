import { useEffect, useState } from 'react';
import { Link, Typography, Surface } from '@visa/nova-react';
import InputBox from './InputBox';
import PreviewPanel from './PreviewPanel';
import OutputPanel from './OutputPanel';
import { UiSpecificationPreview } from '../specification/UiSpecificationPreview';
import { generateTsx } from '../specification/generateTsx';
import { componentRegistry } from '../specification/componentRegistry';
import type { UiNode } from '../specification/componentRegistry';
import type { UiSpecification } from '../specification/uiSpecification';
import { createGenerationRequests } from '../utils/generationRequests';
import type { GenerationState } from '../utils/generationRequests';
import './AiGeneratorSection.css';

const names = {
  textInput: 'Text input', emailInput: 'Email input', passwordInput: 'Password input', checkbox: 'Checkbox',
  button: 'Button', text: 'Text', heading: 'Heading', verticalLayout: 'Vertical layout', horizontalLayout: 'Horizontal layout', form: 'Form',
  textarea: 'Text area', switch: 'Switch', badge: 'Badge', divider: 'Divider', link: 'Link',
  dialog: 'Dialog', flag: 'Flag', footer: 'Footer', select: 'Native select', radioGroup: 'Radio group', contentCard: 'Content card', paymentCard: 'Payment-card fields', progress: 'Progress',
};
const nodes = (node: UiNode): UiNode[] => [node, ...(node.children?.flatMap(nodes) ?? [])];

const examples = [
  { label: 'Email field', prompt: 'Create an email input labeled Work email.' },
  { label: 'Content card', prompt: 'Create a content card titled Analytics with description View your reports.' },
  { label: 'Success flag', prompt: 'Show a dismissible success flag saying Changes saved.' },
  { label: 'Simple form', prompt: 'Create a login form with email, password, and a submit button.' },
] as const;

export function GeneratedInterface({ specification }: { specification: UiSpecification }) {
  const code = generateTsx(specification);
  const selected = Array.from(new Map(nodes(specification.root).map(node => [node.type, node])).values());
  return <>
    <section className="selected-components" aria-label="Selected components">
      <div className="selection-heading">
        <Typography tag="h2" variant="body-2-bold">Selected components</Typography>
        <span>From your validated specification</span>
      </div>
      <ul className="ai-suggestions">
        {selected.map(node => {
          const mapping = componentRegistry[node.type].mapping;
          const count = nodes(specification.root).filter(item => item.type === node.type).length;
          return <li key={node.type}><Link href={mapping.documentation} target="_blank" rel="noreferrer" title={mapping.elements.join(', ')}>
            {names[node.type]}{count > 1 && <span className="component-count"> ×{count}</span>}</Link>
            <span className="sr-only">: {mapping.elements.join(', ')}</span></li>;
        })}
      </ul>
    </section>
    <div className="ai-workspace">
      <PreviewPanel><div className="ai-preview-content" tabIndex={0} role="region" aria-label="Generated interface"
        onSubmitCapture={event => event.preventDefault()}>
        <UiSpecificationPreview specification={specification} />
      </div></PreviewPanel>
      <OutputPanel code={code} />
    </div>
    <p className="generation-note">Example UI only. Form submission and link navigation are prevented in the preview.
      Copied links retain their destinations. No authentication, saving, or network actions are implemented.
      Use synthetic payment details only. This app does not submit or save entered preview values.</p>
  </>;
}

export function AiGeneratorView({ state, onGenerate, onCancel }: {
  state: GenerationState; onGenerate: (prompt: string) => void; onCancel: () => void;
}) {
  const busy = state.status === 'loading';
  const failure = state.status === 'error' || state.status === 'unsupported';
  const connectionError = failure && ['NETWORK_ERROR', 'OLLAMA_UNAVAILABLE', 'WRONG_PROVIDER'].includes(state.code);
  return <section id="generator" className="ai-generator" aria-label="Experimental AI generator">
    <header className="studio-intro">
      <p className="studio-eyebrow"><span aria-hidden="true" />VISA PRODUCT DESIGN SYSTEM <span className="intro-separator">/</span> LOCAL WORKSPACE</p>
      <Typography tag="h1" variant="display-1">Describe it. Preview it. <span>Build it.</span></Typography>
      <p className="intro-description">From a few words to Nova components and reusable React code.<br className="desktop-break" /> Your idea, a working preview, and a place to start building.</p>
    </header>
    <Surface className="studio-prompt" tag="section" aria-label="UI description">
      <div className="prompt-heading"><span className="studio-eyebrow">THE STARTING POINT</span><span className="local-label">Local Ollama <span>· Experimental</span></span></div>
      <InputBox id="ai-ui-desc" descriptionId="ai-scope" maxLength={2000} busy={busy} multiline examples={examples}
        placeholder="A profile form with first and last name side by side, an email field, and a Save button…"
        onSubmit={onGenerate} onCancel={onCancel} />
      <div className="prompt-bottom">
        <p id="ai-scope">Results may miss details. Review each component, property, and layout.<br />Try a simpler description or name the component directly.</p>
        <details className="supported-details">
          <summary>Supported components</summary>
          <div className="supported-content">
            <p>Text, email and password inputs; text areas; checkboxes; switches; radio groups; native selects; buttons;
              text and headings; links; badges; dividers; content cards; payment-card fields; progress indicators; dialogs; flags; footers.</p>
            <p>Supports one optional form, vertical stacking, and adjacent horizontal groups. These families are experimental, not guaranteed outputs.</p>
            <p>Requires the local flat-selection backend. Your description is sent to that backend and local Ollama.</p>
          </div>
        </details>
      </div>
    </Surface>
    <div className="generation-feedback">
      <p id="ai-generation-status" role="status" aria-live="polite" aria-atomic="true">
        <span className={busy ? 'status-dot is-loading' : 'status-dot'} aria-hidden="true" />
        {busy ? 'Generating locally… You can cancel or submit a new description.'
          : state.status === 'cancelled' ? 'Generation cancelled. Your next idea is welcome.'
          : state.status === 'success' ? 'Interface generated. Review the result below.'
          : failure ? 'No generated result is displayed.' : 'Ready when you are. Start with a description or an example.'}
      </p>
      {failure && <div className="generation-error" role="alert">
        <strong>{state.status === 'unsupported' ? 'Unsupported request' : connectionError ? 'Connection or configuration error' : 'Generation could not finish'}</strong>
        <p>{state.message}</p>
      </div>}
    </div>
    <div aria-busy={busy} className="results-region">
      {state.status === 'success' ? <GeneratedInterface key={state.generation} specification={state.specification} />
        : <>
          <div className="workspace-label"><Typography tag="h2" variant="body-2-bold">Your workspace</Typography><span>Preview + React code</span></div>
          <div className="ai-workspace"><PreviewPanel pending={busy} /><OutputPanel code="" /></div>
        </>}
    </div>
  </section>;
}

export default function AiGeneratorSection() {
  const [state, setState] = useState<GenerationState>({ status: 'idle' });
  const [requests] = useState(() => createGenerationRequests(setState));
  useEffect(() => () => requests.dispose(), [requests]);
  return <AiGeneratorView state={state} onGenerate={prompt => { void requests.generate(prompt); }} onCancel={requests.cancel} />;
}
