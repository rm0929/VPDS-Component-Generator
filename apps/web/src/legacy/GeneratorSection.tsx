import React, { useState } from 'react';
import { Utility, Typography, Button } from '@visa/nova-react';
import InputBox from '../components/InputBox';
import LivePreview from '../components/LivePreview';
import OutputPanel from '../components/OutputPanel';

import { suggestComponents } from './suggestComponents';
import { generateCodeSnippet } from './generateCodeSnippet';

// All Preview components…
import LoginFormPreview from './previews/LoginFormPreview';
import CardFormPreview from './previews/CardFormPreview';
import SignupFormPreview from './previews/SignupFormPreview';
import AddressFormPreview from './previews/AddressFormPreview';
import UserProfilePreview from './previews/UserProfilePreview';
import DateTimePreview from './previews/DateTimePreview';
import TablePreview from './previews/TablePreview';
import NotificationTrayPreview from './previews/NotificationTrayPreview';
import ModalPreview from './previews/ModalPreview';
import DeterminateProgressPreview from './previews/DeterminateProgressPreview';


const GeneratorSection: React.FC = () => {
  const [preview, setPreview] = useState<React.ReactNode | null>(null);
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);

  const handleGenerate = (input: string) => {
    const comps = suggestComponents(input);
    setCode(generateCodeSnippet(comps));
    setShowCode(false);

    const lower = input.toLowerCase();
    if (comps.includes('LoginForm')) {
      setPreview(<LoginFormPreview includeRemember={lower.includes('remember me')} />);
    } else if (comps.includes('CardForm')) {
      setPreview(<CardFormPreview />);
    } else if (comps.includes('SignupForm')) {
      setPreview(<SignupFormPreview />);
    } else if (comps.includes('AddressForm')) {
      setPreview(<AddressFormPreview />);
    } else if (comps.includes('UserProfile')) {
      setPreview(<UserProfilePreview />);
    } else if (comps.includes('DateTime')) {
      setPreview(<DateTimePreview showDate={lower.includes('date')} showTime={lower.includes('time')} />);
    } else if (comps.includes('Table')) {
      setPreview(<TablePreview />);
    } else if (comps.includes('NotificationTray')) {
      setPreview(<NotificationTrayPreview />);
    } else if (comps.includes('Modal')) {
      setPreview(<ModalPreview open onClose={() => {}} />);
    } else if (comps.includes('DeterminateProgress')) {
      setPreview(<DeterminateProgressPreview />);
    } else {
      setPreview(null);
    }
  };

  return (
    <Utility
      id="generator"
      tag="section"
      vFlex
      vFlexCol
      vAlignItems="center"
      style={{ padding: '4rem 1rem', background: 'var(--palette-default-surface-1)' }}
    >
      <Typography variant="headline-2" tag="h2" colorScheme="active">
        Legacy keyword demo
      </Typography>
      <Typography>Fixed keyword examples only. This secondary demo does not use AI.</Typography>
        <Utility style={{ marginTop: '1rem', width: '100%', maxWidth: '600px' }}>
            <InputBox onSubmit={handleGenerate} />
        </Utility>

      {preview && (
        <>
          <LivePreview>{preview}</LivePreview>
          <Button
            onClick={() => setShowCode(true)}
            buttonSize="large"
            style={{ marginTop: '1rem' }}
          >
            Get Code
          </Button>
        </>
      )}

      {showCode && (
        <Utility style={{ marginTop: '1rem', width: '100%', maxWidth: '600px' }}>
        <OutputPanel code={code} />
        </Utility>
    )}
    </Utility>
  );
};

export default GeneratorSection;
