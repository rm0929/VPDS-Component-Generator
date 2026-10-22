import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import GeneratorSection from './components/GeneratorSection';
import SpecificationDemo from './components/SpecificationDemo';
import AiGeneratorSection from './components/AiGeneratorSection';
import lightThemeHref from '@visa/nova-styles/themes/visa-light/index.css?url';
import darkThemeHref from '@visa/nova-styles/themes/visa-dark/index.css?url';
import './App.css';

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const parameters = new URLSearchParams(window.location.search);
  const specificationDemo = parameters.get('demo') === 'specification';
  const keywordDemo = !specificationDemo && parameters.get('generator') === 'keyword';
  const view = specificationDemo ? 'specification' : keywordDemo ? 'keyword' : 'ai';

  useEffect(() => {
    let link = document.getElementById('nova-theme') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = 'nova-theme';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = darkMode ? darkThemeHref : lightThemeHref;
    document.documentElement.style.colorScheme = darkMode ? 'dark' : 'light';
  }, [darkMode]);

  return <div className="studio" data-theme={darkMode ? 'dark' : 'light'}>
    <a className="skip-link" href="#generator">Skip to generator</a>
    <Navbar darkMode={darkMode} onToggleDarkMode={setDarkMode} view={view} />
    <main className="studio-main">
      {view !== 'ai' && <h1 className="demo-page-title">{view === 'keyword' ? 'Legacy keyword demo' : 'Specification demo'}</h1>}
      {specificationDemo ? <SpecificationDemo /> : keywordDemo ? <GeneratorSection /> : <AiGeneratorSection />}
    </main>
    <footer className="studio-footer">
      <span>Built with Visa Nova React</span>
      <span>Local inference. Real components. Your next starting point.</span>
    </footer>
  </div>;
}
