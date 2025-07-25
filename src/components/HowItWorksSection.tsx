// src/components/HowItWorksSection.tsx
import React from 'react';
import { Utility, Typography } from '@visa/nova-react';
import { VisaChevronRightTiny, VisaCheckTiny, VisaCopyTiny } from '@visa/nova-icons-react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

const steps = [
  { icon: <VisaChevronRightTiny />, label: 'Describe your UI need' },
  { icon: <VisaCheckTiny />,       label: 'Preview live Nova-React component' },
  { icon: <VisaCopyTiny />,        label: 'Copy ready-to-use React code' },
];

const HowItWorksSection: React.FC = () => (
  <Utility
    id="how-it-works"
    tag="section"
    vFlex
    vFlexCol
    vAlignItems="center"
    style={{ padding: '4rem 1rem' }}
  >
    {/* Section heading */}
    <Typography variant="headline-2" tag="h2" colorScheme="active">
      How It Works
    </Typography>

    {/* Row with left animation, steps, right animation */}
    <Utility
      vFlex
      vFlexRow
      vAlignItems="start"
      vJustifyContent="center"
      style={{ flexWrap: 'wrap', marginTop: '2rem', width: '100%' }}
    >
      {/* Left Lottie */}
      <Utility style={{ width: '140px', marginRight: '3rem' }}>
        <DotLottieReact
          src="/Messages.lottie"
          autoplay
          loop
          style={{ width: '100%', height: 'auto' }}
        />
      </Utility>

      {/* Center steps */}
      <Utility
        vFlex
        vFlexRow
        vJustifyContent="center"
        vAlignItems="start"
        vGap={40}
        style={{
          flex: '0 1 auto',      // don't force it to grow
          flexWrap: 'wrap',
          padding: '0 1rem',
        }}
      >
        {steps.map((step, i) => (
          <Utility
            key={i}
            vFlex
            vFlexCol
            vAlignItems="center"
            style={{ maxWidth: '200px', textAlign: 'center', padding: '0 2rem' }}
          >
            <Utility
              style={{
                fontSize: '2rem',
                color: 'var(--palette-default-active)',
                marginBottom: '1rem',
              }}
            >
              {step.icon}
            </Utility>
            <Typography variant="body-1">{step.label}</Typography>
          </Utility>
        ))}
      </Utility>

      {/* Right Lottie */}
      <Utility style={{ width: '120px', marginLeft: '3rem' }}>
        <DotLottieReact
          src="/DocumentNotify.lottie"
          autoplay
          loop
          style={{ width: '150%', height: 'auto' }}
        />
      </Utility>
    </Utility>
  </Utility>
);

export default HowItWorksSection;
