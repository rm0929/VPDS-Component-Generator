import React from 'react';
import { Utility, Typography } from '@visa/nova-react';
import { VisaChevronRightTiny, VisaCheckTiny, VisaCopyTiny } from '@visa/nova-icons-react';

const steps = [
  { icon: <VisaChevronRightTiny />, label: 'Describe your UI need' },
  { icon: <VisaCheckTiny />, label: 'Preview live Nova‑React component' },
  { icon: <VisaCopyTiny />, label: 'Copy ready‑to‑use React code' },
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
    <Typography variant="headline-2" tag="h2" colorScheme="active">
      How It Works
    </Typography>
    <Utility vFlex vFlexRow vJustifyContent="center" vAlignItems="start" vGap={40} style={{ flexWrap: 'wrap', marginTop: '2rem' }}>
      {steps.map((step, i) => (
        <Utility
          key={i}
          vFlex
          vFlexCol
          vAlignItems="center"
          style={{ maxWidth: '200px', textAlign: 'center' }}
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
  </Utility>
);

export default HowItWorksSection;
