import React from 'react';
import { Utility, Typography, Button } from '@visa/nova-react';
import { VisaAccountLow, VisaChevronDownHigh } from '@visa/nova-icons-react';

interface HeroProps {
  onGetStarted: () => void;
}

const HeroSection: React.FC<HeroProps> = ({ onGetStarted }) => (
  <Utility
    id="hero"
    tag="section"
    vFlex
    vFlexCol
    vAlignItems="center"
    style={{
      minHeight: 'auto',
      padding: '4rem 1rem',
      background: 'var(--palette-default-surface-highlight)',
      textAlign: 'center',
    }}
  >
    <VisaAccountLow style={{ fontSize: '4rem', color: 'var(--palette-default-active)' }} />
    <Typography variant="display-2" colorScheme="active" style={{ marginTop: '1rem' }}>
      Instant Nova‑React Patterns
    </Typography>
    <Typography
      variant="body-1"
      style={{ maxWidth: '600px', marginTop: '1rem', color: 'var(--palette-default-text)' }}
    >
      Describe a UI component in your own words, preview it live, and copy the React code—styled
      with Visa’s Nova Design System.
    </Typography>
    <Button
      buttonSize="large"
      style={{ marginTop: '2rem' }}
      onClick={onGetStarted}
    >
      Get Components 
      <VisaChevronDownHigh/>
    </Button>
  </Utility>
);

export default HeroSection;
