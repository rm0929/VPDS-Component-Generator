import React from 'react';
import { Utility, Label, InputContainer, Input, Checkbox, Button } from '@visa/nova-react';

interface Props {
  includeRemember: boolean;
}

const LoginFormPreview: React.FC<Props> = ({ includeRemember }) => (
  <Utility vFlex vFlexCol vGap={8}>
    <Label htmlFor="email">Email</Label>
    <InputContainer>
      <Input id="email" type="email" placeholder="Enter email" />
    </InputContainer>

    <Label htmlFor="password">Password</Label>
    <InputContainer>
      <Input id="password" type="password" placeholder="Enter password" />
    </InputContainer>

    {includeRemember && (
      <Utility vAlignItems="center" vFlex vGap={2}>
        <Checkbox id="remember-me" />
        <Label htmlFor="remember-me">Remember me</Label>
      </Utility>
    )}

    <Button>Login</Button>
  </Utility>
);

export default LoginFormPreview;