import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import materialDark from 'react-syntax-highlighter/dist/esm/styles/prism/material-dark';
import { Surface, Utility, Typography, Button } from '@visa/nova-react';
import { VisaCopyTiny } from '@visa/nova-icons-react';

interface Props {
  code: string;
}

const OutputPanel: React.FC<Props> = ({ code }) => {
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Surface
      style={{
        width: '100%',
        maxWidth: '600px',
        padding: '1rem',
        backgroundColor: 'var(--palette-default-surface-2)',
        border: '1px solid var(--palette-default-border)',
        borderRadius: '6px',
      }}
    >
      <Utility vFlex vFlexCol vGap={8}>
        <Typography variant="headline-4" tag="h2" colorScheme="default">
          Generated Code
        </Typography>

        <div
         style={{
           position: 'relative',
           backgroundColor: 'var(--palette-default-surface-1)',
           border: '1px solid var(--palette-default-border)',
           borderRadius: '4px',
         }}
       >
          <div style={{ position: 'absolute', top: 8, right: 8, textAlign: 'right', zIndex: 10 }}>
            {copied && (
              <Typography
                variant="body-2"
                style={{
                  backgroundColor: 'var(--palette-default-surface-2)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  marginBottom: '4px',
                  color: 'var(--palette-default-text)',
                }}
              >
                Copied!
              </Typography>
            )}
            <Button
              iconButton
              onClick={handleCopy}
              aria-label="Copy code to clipboard"
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              style={{
                backgroundColor: 'transparent',
                boxShadow: 'none',
              }}
            >
              <VisaCopyTiny style={{ color: hovered ? '#fcc015' : '#BDEAFF' }} />
            </Button>
          </div>

          <SyntaxHighlighter
            language="tsx"
            style={materialDark}
            showLineNumbers
            customStyle={{
              margin: 0,
              padding: '1rem',
              fontFamily: 'monospace',
            }}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      </Utility>
    </Surface>
  );
};

export default OutputPanel;