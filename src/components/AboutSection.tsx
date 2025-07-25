import React from 'react';
import { Utility, Typography, Link } from '@visa/nova-react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

const AboutSection: React.FC = () => (
  <Utility
    id="about"
    tag="section"
    vFlex
    vFlexRow
    vJustifyContent="between"
    vAlignItems="center"
    style={{
      padding: '4rem 1rem',
      background: 'var(--palette-default-surface-2)',
      flexWrap: 'wrap'
    }}
  >
  
    <Utility style={{ flex: 1, minWidth: '200px', maxWidth: '25%', padding: '1rem' }}>
      <DotLottieReact
        src="/Desktop.lottie"
        loop
        autoplay
        style={{ width: '100%', height: 'auto' }}
      />
    </Utility>


    <Utility
      vFlex
      vFlexCol
      vAlignItems="center"
      style={{ flex: 2, minWidth: '300px', maxWidth: '50%', padding: '1rem' }}
    >
      <Typography variant="headline-2" tag="h2" colorScheme="active">
        What is VPDS UI Generator?
      </Typography>
      <Typography
        variant="body-1"
        style={{
          maxWidth: '600px',
          marginTop: '1rem',
          color: 'var(--palette-default-text-subtle)',
          textAlign: 'center',
        }}
      >
        Inspired by Visa's Product Design System, this tool lets you describe any UI pattern-
        from login forms to card input, and instantly see Nova-React components rendered live,
        plus copy-ready React code. Build faster, stay on brand.
      </Typography>
      <Typography variant="body-2" style={{ marginTop: '1rem' }}>
        Learn more on{' '}
        <Link
          href="https://github.com/rm0929/VPDS-Component-Generator"
          target="_blank"
          noUnderline
        >
          GitHub
        </Link>
      </Typography>
    </Utility>

    <Utility style={{ flex: 1, minWidth: '200px', maxWidth: '25%', padding: '1rem' }}>
      <DotLottieReact
        src="/VisaBranding.lottie"
        loop
        autoplay
        style={{ width: '100%', height: 'auto' }}
      />
    </Utility>
  </Utility>
);

export default AboutSection;
