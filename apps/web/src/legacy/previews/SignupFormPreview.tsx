import React from 'react';
import {
  Utility,
  Label,
  InputContainer,
  Input,
  InputControl,
  Button,
  Checkbox,
} from '@visa/nova-react';
import { VisaChevronDownTiny } from '@visa/nova-icons-react';

const SignupFormPreview: React.FC = () => (
  <Utility vFlex vFlexCol vGap={16} style={{ width: '100%', maxWidth: '400px' }}>
    {/* First & Last Name */}
    <Label htmlFor="first-name">First Name</Label>
    <InputContainer>
      <Input id="first-name" placeholder="John" />
    </InputContainer>

    <Label htmlFor="last-name">Last Name</Label>
    <InputContainer>
      <Input id="last-name" placeholder="Doe" />
    </InputContainer>

    {/* Email */}
    <Label htmlFor="email">Email</Label>
    <InputContainer style={{ position: 'relative' }}>
      <Input id="email" type="email" placeholder="you@example.com" style={{ paddingRight: '2.5rem' }} />
      <InputControl style={{ right: '0.75rem' }}>
        <VisaChevronDownTiny /> {/* or another appropriate icon */}
      </InputControl>
    </InputContainer>

    {/* Password */}
    <Label htmlFor="password">Password</Label>
    <InputContainer>
      <Input id="password" type="password" placeholder="••••••••" />
    </InputContainer>

    {/* Confirm Password */}
    <Label htmlFor="confirm-password">Confirm Password</Label>
    <InputContainer>
      <Input id="confirm-password" type="password" placeholder="••••••••" />
    </InputContainer>

    {/* Terms & Conditions */}
    <Utility vAlignItems="center" vFlex vGap={4}>
      <Checkbox id="terms" />
      <Label htmlFor="terms">
        I agree to the <a href="#">Terms & Conditions</a>
      </Label>
    </Utility>

    {/* Signup Button */}
    <Button buttonSize="large">Sign Up</Button>
  </Utility>
);

export default SignupFormPreview;
