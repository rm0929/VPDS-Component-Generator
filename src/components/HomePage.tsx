import React from 'react';
import { Utility, Typography, Button } from '@visa/nova-react';
import { VisaAccountLow } from '@visa/nova-icons-react';

interface HomeProps {
  onStart: () => void;
}

const HomePage: React.FC<HomeProps> = ({ onStart }) => {
  return (
    <Utility
      vFlex
      vFlexCol
      vAlignItems="center"
      vJustifyContent="center"
      style={{ minHeight: '100vh', padding: '2rem', textAlign: 'center' }}
    >
      {/* Logo or Icon */}
      <VisaAccountLow style={{ fontSize: '4rem', marginBottom: '1rem' }} />

      {/* Site Title */}
      <Typography variant="display-2" colorScheme="active">
        VPDS UI Generator
      </Typography>

      {/* Short Description */}
      <Typography
        variant="body-1"
        style={{ maxWidth: '600px', marginTop: '1rem', color: 'var(--palette-default-text-subtle)' }}
      >
        A lightweight React playground “inspired by Visa’s Product Design System” —
        describe a UI pattern and instantly see Visa‑Nova components & code.  
        Build, preview, copy, and go!
      </Typography>

      {/* Call to Action */}
      <Button
        buttonSize="large"
        style={{ marginTop: '2rem' }}
        onClick={onStart}
      >
        Get Components
      </Button>

      {/* Optional extras to make it more visual: */}
      <Utility vFlex vFlexRow vJustifyContent="center" vGap={24} vPaddingTop={48}>
        <Typography variant="subtitle-1" colorScheme="subtle">
          ⭐ Favorite patterns  
        </Typography>
        <Typography variant="subtitle-1" colorScheme="subtle">
          🌟 Export as .tsx  
        </Typography>
        <Typography variant="subtitle-1" colorScheme="subtle">
          🎨 Theme toggle  
        </Typography>
      </Utility>
    </Utility>
  );
};

export default HomePage;
