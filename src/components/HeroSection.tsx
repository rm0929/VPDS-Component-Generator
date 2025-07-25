// src/components/HeroSection.tsx
import React from 'react';
import { Utility, Typography, Button } from '@visa/nova-react';
import { VisaChevronDownHigh } from '@visa/nova-icons-react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

const HeroSection: React.FC = () => (
  <Utility
    id="hero"
    tag="section"
    vFlex
    vFlexRow
    vJustifyContent="between"
    vAlignItems="center"
    style={{
        minHeight: '60vh',
      padding: '2rem 1rem',
      background: 'var(--palette-default-surface-highlight)',
    }}
  >
    {/* Left column: text & CTA */}
    <Utility
      vFlex
      vFlexCol
      vAlignItems="start"
      style={{ flex: 1, maxWidth: '50%', paddingRight: '1rem',paddingLeft: '5rem' }}
    >
      <Typography variant="display-1" colorScheme="default">
        Welcome to VPDS UI Generator
      </Typography>
      <Typography
        variant="subtitle-1"
        style={{ marginTop: '1rem', maxWidth: '600px' }}
      >
        Describe your UI pattern in plain English and instantly preview & copy
        Visa Nova‑React code snippets.
      </Typography>
      <Button
        buttonSize="large"
        style={{ marginTop: '2.5rem' }}
        onClick={() =>
          document
            .getElementById('generator')
            ?.scrollIntoView({ behavior: 'smooth' })
        }
      >
        Get Components
        <VisaChevronDownHigh/>
      </Button>
    </Utility>

    {/* Right column: Lottie animation */}
    <Utility style={{ flex: 1, maxWidth: '50%' }}>
      <div style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
        <DotLottieReact
          src="/UIUX.lottie"
          loop
          autoplay
          style={{ width: '120%', height: 'auto' }}
        />
      </div>
    </Utility>
  </Utility>
);

export default HeroSection;
