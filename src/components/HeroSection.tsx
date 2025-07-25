import React from 'react';
import { Utility, Typography, Button } from '@visa/nova-react';
import { VisaChevronDownHigh } from '@visa/nova-icons-react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

interface HeroSectionProps {
  onGetStarted: () => void;
}

const HeroSection: React.FC<HeroSectionProps> = ({ onGetStarted }) => (
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
    {/* Left section */}
    <Utility
      vFlex
      vFlexCol
      vAlignItems="start"
      style={{ flex: 1, maxWidth: '50%', paddingRight: '1rem', paddingLeft: '5rem' }}
    >
      <Typography variant="display-1" colorScheme="default">
        Welcome to VPDS UI Generator
      </Typography>
      <Typography
        variant="subtitle-1"
        style={{ marginTop: '1rem', maxWidth: '600px' }}
      >
        Describe UI pattern in plain English and instantly get
        Visa design systems components.
      </Typography>
      <Button
        buttonSize="large"
        onClick={onGetStarted}
        style={{ marginTop: '2.5rem' }}
      >
        Get Components&nbsp;
        <VisaChevronDownHigh />
      </Button>
    </Utility>

    {/* Right Section Animation */}
    <Utility style={{ flex: 1, maxWidth: '50%' }}>
      <div style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
        <DotLottieReact
          src="/UIUX.lottie"
          autoplay
          loop
          style={{ width: '120%', height: 'auto' }}
        />
      </div>
    </Utility>
  </Utility>
);

export default HeroSection;