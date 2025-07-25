import { useState, useEffect } from 'react';
import { Utility } from '@visa/nova-react';

import Navbar from './components/Navbar';
import AboutSection from './components/AboutSection';
import HeroSection from './components/HeroSection';
import HowItWorksSection from './components/HowItWorksSection';
import GeneratorSection from './components/GeneratorSection';

import lightThemeHref from '@visa/nova-styles/themes/visa-light/index.css?url';
import darkThemeHref  from '@visa/nova-styles/themes/visa-dark/index.css?url';

export default function App() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    let link = document.getElementById('nova-theme') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = 'nova-theme';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = darkMode ? darkThemeHref : lightThemeHref;
  }, [darkMode]);

  const scrollToGenerator = () => {
    document.getElementById('generator')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <Utility vFlex vFlexCol vGap={0}>
      <Navbar darkMode={darkMode} onToggleDarkMode={setDarkMode} />

      <HeroSection onGetStarted={scrollToGenerator} />
      <AboutSection />
      <HowItWorksSection />
      <GeneratorSection />
    </Utility>
  );
}
