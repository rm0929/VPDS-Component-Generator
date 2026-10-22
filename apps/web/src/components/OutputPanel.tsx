import { useEffect, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { Surface, Typography, Button } from '@visa/nova-react';
import { VisaCopyTiny, VisaCodeSnippetLow } from '@visa/nova-icons-react';
import { createClipboardFeedback } from '../utils/clipboardFeedback';
import type { CopyState } from '../utils/clipboardFeedback';

interface Props { code: string }

function CodePanel({ code }: Props) {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const [clipboard] = useState(() => createClipboardFeedback(setCopyState));
  useEffect(() => () => clipboard.dispose(), [clipboard]);
  return <Surface className="studio-panel code-panel" tag="section" aria-label="Generated code">
    <div className="panel-heading">
      <div><span className="panel-index" aria-hidden="true">02</span>
        <Typography tag="h3" variant="body-2-bold">GeneratedUI.tsx</Typography>
      </div>
      <span className="panel-meta">REACT · TSX</span>
    </div>
    <div className="code-toolbar">
      <span>{code ? 'Generated Code' : 'Your next starting point'}</span>
      <Button type="button" colorScheme="tertiary" buttonSize="small" className="copy-button"
        disabled={!code || copyState === 'copying'} onClick={() => { void clipboard.copy(code); }} aria-label="Copy code to clipboard">
        <VisaCopyTiny aria-hidden="true" />{copyState === 'copying' ? 'Copying…' : copyState === 'copied' ? 'Copied!' : 'Copy code'}
      </Button>
    </div>
    {code ? <div className="code-scroll">
      <SyntaxHighlighter language="tsx" tabIndex={0} aria-label="Generated React TSX" useInlineStyles={false} showLineNumbers
        customStyle={{ margin: 0, padding: '1.25rem 1rem', background: 'transparent', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'auto' }}>
        {code}
      </SyntaxHighlighter>
    </div> : <div className="workspace-empty code-empty">
      <VisaCodeSnippetLow aria-hidden="true" />
      <Typography tag="h4" variant="headline-4">Readable. Reusable. Yours.</Typography>
      <p>Your React TSX will appear here.<br />Inspect it, copy it, and make it your own.</p>
    </div>}
    <div className="panel-footnote copy-feedback" role="status" aria-live="polite" aria-atomic="true">
      {copyState === 'error' ? 'Copy failed. Select the code and copy it manually.'
        : copyState === 'copied' ? 'Copied to your clipboard.' : copyState === 'copying' ? 'Waiting for clipboard access…' : code ? 'Example UI code · Add your application behavior.' : 'No code generated yet.'}
    </div>
  </Surface>;
}

export default function OutputPanel({ code }: Props) {
  return <CodePanel key={code} code={code} />;
}
