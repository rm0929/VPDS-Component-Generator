import React, { useState } from 'react';
import { Utility, Typography, Button } from '@visa/nova-react';
import InputBox from './InputBox';
import LivePreview from './LivePreview';
import OutputPanel from './OutputPanel';

import { suggestComponents } from '../utils/suggestComponents';
import { generateCodeSnippet } from '../utils/generateCodeSnippet';

// import all Preview components…
import LoginFormPreview from './LoginFormPreview';
import CardFormPreview from './CardFormPreview';
import SignupFormPreview from './SignupFormPreview';
import AddressFormPreview from './AddressFormPreview';
import UserProfilePreview from './UserProfilePreview';
import DateTimePreview from './DateTimePreview';
import TablePreview from './TablePreview';
import NotificationTrayPreview from './NotificationTrayPreview';
import ModalPreview from './ModalPreview';
import DeterminateProgressPreview from './DeterminateProgressPreview';


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
        Try It Now
      </Typography>
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
