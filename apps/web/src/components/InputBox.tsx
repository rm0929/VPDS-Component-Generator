import { useRef, useState } from 'react';
import { Label, Input, Textarea, InputContainer, Button } from '@visa/nova-react';
import { VisaArrowForwardTiny } from '@visa/nova-icons-react';

interface Props {
  onSubmit: (input: string) => void;
  id?: string;
  maxLength?: number;
  descriptionId?: string;
  busy?: boolean;
  placeholder?: string;
  multiline?: boolean;
  examples?: readonly { label: string; prompt: string }[];
  onCancel?: () => void;
}

export default function InputBox({ onSubmit, id = 'ui-desc', maxLength, descriptionId, busy = false,
  placeholder = 'e.g. login form with remember me', multiline = false, examples = [], onCancel }: Props) {
  const [input, setInput] = useState('');
  const textarea = useRef<HTMLTextAreaElement>(null);
  return <form className="prompt-form" onSubmit={event => {
    event.preventDefault();
    if (input.trim()) onSubmit(input.trim());
  }}>
    <div className="prompt-label-row">
      <Label htmlFor={id}>{multiline ? 'Describe your interface' : 'UI Description'}</Label>
      {maxLength && <span className="prompt-count" aria-label="Description length">{input.length.toLocaleString()} / {maxLength.toLocaleString()}</span>}
    </div>
    <InputContainer className="prompt-input-container">
      {multiline ? <Textarea<HTMLTextAreaElement> id={id} ref={textarea} rows={3} maxLength={maxLength}
        aria-describedby={descriptionId} value={input} placeholder={placeholder}
        onChange={event => setInput(event.currentTarget.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault(); event.currentTarget.form?.requestSubmit();
          }
        }} />
        : <Input id={id} maxLength={maxLength} aria-describedby={descriptionId} value={input} placeholder={placeholder}
          onChange={event => setInput((event.target as HTMLInputElement).value)} />}
    </InputContainer>
    {examples.length > 0 && <div className="prompt-examples" aria-label="Example requests">
      <span>Try a starting point</span>
      {examples.map(example => <Button key={example.label} type="button" colorScheme="tertiary" buttonSize="small"
        className="example-button" onClick={() => { setInput(example.prompt); textarea.current?.focus(); }}>
        {example.label}
      </Button>)}
    </div>}
    <div className="prompt-actions">
      <span className="prompt-shortcut">{multiline ? <><kbd>⌘</kbd> / <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to generate</> : 'Built with Visa Nova React'}</span>
      <div className="prompt-buttons">
        {busy && onCancel && <Button type="button" colorScheme="tertiary" onClick={onCancel}>Cancel generation</Button>}
        <Button type="submit" buttonSize="large" className="generate-button">
          {busy ? 'Generate again' : 'Generate'}<VisaArrowForwardTiny aria-hidden="true" />
        </Button>
      </div>
    </div>
  </form>;
}
