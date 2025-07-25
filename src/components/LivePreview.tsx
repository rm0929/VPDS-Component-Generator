// src/components/LivePreview.tsx
import React from 'react';
import { Surface } from '@visa/nova-react';

interface Props {
  children: React.ReactNode;
}

const LivePreview: React.FC<Props> = ({ children }) => (
  <Surface
    style={{
      width: '100%',
      maxWidth: '600px',
      padding: '1rem',
      marginTop: '1rem',
      backgroundColor: 'var(--palette-default-surface-2)',
      border: '1px solid var(--palette-default-border)',
      borderRadius: '6px',
    }}
  >
    {children}
  </Surface>
);

export default LivePreview;
