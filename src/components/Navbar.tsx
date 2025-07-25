// src/components/Navbar.tsx
import React from 'react';
import { Utility, Typography, Switch } from '@visa/nova-react';
import { VisaModeLightTiny, VisaModeDarkTiny } from '@visa/nova-icons-react';

interface NavbarProps {
  darkMode: boolean;
  onToggleDarkMode: (dark: boolean) => void;
}

const Navbar: React.FC<NavbarProps> = ({ darkMode, onToggleDarkMode }) => (
  <Utility
    vFlex
    vFlexRow
    vJustifyContent="between"
    vAlignItems="center"
    vPadding={16}
    style={{
      width: '100%',
      background: 'var(--palette-default-surface-1)',
      borderBottom: '1px solid var(--palette-default-border)',
    }}
  >
    <Typography variant="headline-4" tag="h1" colorScheme="default">
      Component Suggestion Tool
    </Typography>

    <Utility vFlex vFlexRow vAlignItems="center" vGap={8}>
      {darkMode ? <VisaModeDarkTiny /> : <VisaModeLightTiny />}
      <Switch
        id="dark-mode-toggle"
        checked={darkMode}
        onChange={e => onToggleDarkMode((e.target as HTMLInputElement).checked)}
        aria-label="Toggle dark mode"
      />
    </Utility>
  </Utility>
);

export default Navbar;
