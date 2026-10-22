import type { ReactNode } from 'react';
import { Typography } from '@visa/nova-react';
import { VisaDeviceLaptopLow } from '@visa/nova-icons-react';
import LivePreview from './LivePreview';

export default function PreviewPanel({ children, pending = false }: { children?: ReactNode; pending?: boolean }) {
  return <section className="studio-panel preview-panel" aria-label="Live preview">
    <div className="panel-heading">
      <div><span className="panel-index" aria-hidden="true">01</span><Typography tag="h3" variant="body-2-bold">Live preview</Typography></div>
      <span className="panel-meta">NOVA REACT</span>
    </div>
    <div className="preview-canvas">
      <LivePreview>{children ?? <div className="workspace-empty">
        <VisaDeviceLaptopLow aria-hidden="true" />
        <Typography tag="h4" variant="headline-4">{pending ? 'Bringing your description to life' : 'An idea, waiting to take shape.'}</Typography>
        <p>{pending ? 'Your local model is selecting components. The preview will appear here.' : 'Describe an interface above. Your Nova components will appear here, ready to explore.'}</p>
      </div>}</LivePreview>
    </div>
    <div className="panel-footnote">{children ? 'Interactive preview · Submission and navigation are contained.' : 'Your generated interface will be rendered here.'}</div>
  </section>;
}
