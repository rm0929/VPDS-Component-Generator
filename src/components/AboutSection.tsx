import React from 'react';
import { Utility, Typography, Link } from '@visa/nova-react';

const AboutSection: React.FC = () => (
  <Utility
    id="about"
    tag="section"
    vFlex
    vFlexCol
    vAlignItems="center"
    style={{ padding: '4rem 1rem', background: 'var(--palette-default-surface-2)' }}
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
      Inspired by Visa’s Product Design System, this tool lets you describe any UI pattern—
      from login forms to modals—and instantly see Nova‑React components rendered live,
      plus copy‑ready React code. Build faster, stay on brand.
    </Typography>
    <Typography variant="body-2" style={{ marginTop: '1rem' }}>
      Learn more on{' '}
      <Link href="https://github.com/your-repo" target="_blank" noUnderline>
        GitHub
      </Link>
      .
    </Typography>
  </Utility>
);

export default AboutSection;
