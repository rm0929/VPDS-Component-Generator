import { Link, Switch, VisaLogo } from '@visa/nova-react';
import { VisaChevronDownTiny, VisaModeLightTiny, VisaModeDarkTiny, VisaCodeForkTiny } from '@visa/nova-icons-react';

interface NavbarProps {
  darkMode: boolean;
  onToggleDarkMode: (dark: boolean) => void;
  view: 'ai' | 'keyword' | 'specification';
}

export default function Navbar({ darkMode, onToggleDarkMode, view }: NavbarProps) {
  return <header className="studio-header">
    <div className="studio-header-inner">
      <Link href="./" className="studio-brand" aria-label="Visa VPDS Component Studio home">
        <VisaLogo className="studio-logo" aria-hidden="true" />
        <span className="brand-divider" aria-hidden="true" />
        <span>Component <strong>Studio</strong><small>VPDS COMPONENT GENERATOR</small></span>
      </Link>
      <div className="header-actions">
        <details className="demo-menu">
          <summary>Demos <VisaChevronDownTiny aria-hidden="true" /></summary>
          <nav aria-label="Generator views">
            <Link href="?#generator" aria-current={view === 'ai' ? 'page' : undefined}>Experimental AI</Link>
            <Link href="?generator=keyword#generator" aria-current={view === 'keyword' ? 'page' : undefined}>Legacy keyword demo</Link>
            <Link href="?demo=specification#generator" aria-current={view === 'specification' ? 'page' : undefined}>Specification demo</Link>
          </nav>
        </details>
        <Link href="https://github.com/rm0929/VPDS-Component-Generator" target="_blank" rel="noreferrer" className="github-link" aria-label="GitHub repository (opens in a new tab)">
          <VisaCodeForkTiny aria-hidden="true" /><span>GitHub</span><span className="sr-only"> (opens in a new tab)</span>
        </Link>
        <div className="theme-control">
          {darkMode ? <VisaModeDarkTiny aria-hidden="true" /> : <VisaModeLightTiny aria-hidden="true" />}
          <Switch id="dark-mode-toggle" checked={darkMode}
            onChange={event => onToggleDarkMode((event.target as HTMLInputElement).checked)} aria-label="Toggle dark mode" />
        </div>
      </div>
    </div>
  </header>;
}
