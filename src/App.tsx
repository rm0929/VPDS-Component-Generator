import { useState, useEffect } from 'react';
import { Utility } from '@visa/nova-react';

import Navbar from './components/Navbar';
import AboutSection from './components/AboutSection';
import HeroSection from './components/HeroSection';
import HowItWorksSection from './components/HowItWorksSection';
import GeneratorSection from './components/GeneratorSection';

export default function App() {
  const [darkMode, setDarkMode] = useState(false);

  // update theme attribute
  useEffect(() => {
    document.documentElement.setAttribute(
      'data-theme',
      darkMode ? 'visa-dark' : 'visa-light'
    );
  }, [darkMode]);

  // scroll target from hero “Get Components”
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
