import React, { useState } from 'react';
import { Label, Input, InputContainer, Button, Utility, Typography } from '@visa/nova-react';

interface Props {
  onSubmit: (input: string) => void;
}

const InputBox: React.FC<Props> = ({ onSubmit }) => {
  const [input, setInput] = useState('');

  return (
    <Utility vFlex vFlexCol vGap={12} style={{ width: '100%', maxWidth: '600px' }}>
      <Typography variant="headline-4">Describe your UI need</Typography>
      <Label htmlFor="ui-desc">UI Description</Label>
      <InputContainer>
        <Input
          id="ui-desc"
          value={input}
          onChange={(e) => setInput((e.target as HTMLInputElement).value)}
          placeholder="e.g. login form with remember me"
        />
      </InputContainer>
      <Button buttonSize="large" onClick={() => input.trim() && onSubmit(input.trim())}>
        Generate
      </Button>
    </Utility>
  );
};

export default InputBox;