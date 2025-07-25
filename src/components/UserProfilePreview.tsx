// src/components/UserProfilePreview.tsx
import React from 'react';
import {
  Utility,
  Label,
  InputContainer,
  Input,
  Select,
  InputControl,
  Radio,
  Button,
  Avatar,
} from '@visa/nova-react';
import { VisaChevronDownTiny, VisaAccountLow } from '@visa/nova-icons-react';

const pronouns = ['He/Him', 'She/Her', 'They/Them'];
const genders = ['Male', 'Female', 'Other'];

const UserProfilePreview: React.FC = () => (
  <Utility
    vFlex
    vFlexCol
    vAlignItems="center"
    vGap={16}
    style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}
  >
    {/* Avatar */}
    <Avatar aria-label="User Avatar"
      style={{
        '--v-avatar-size': '80px',          // override default size
        '--v-avatar-font-size': '32px',     // increase icon/text size inside
      } as React.CSSProperties}>
      <VisaAccountLow />
    </Avatar>

    {/* Name fields inline */}
    <Utility vFlex vFlexRow vGap={8} style={{ width: '100%' }}>
      <Utility vFlex vFlexCol style={{ flex: 1 }}>
        <Label htmlFor="first-name">First Name</Label>
        <InputContainer>
          <Input id="first-name" placeholder="John" />
        </InputContainer>
      </Utility>
      <Utility vFlex vFlexCol style={{ flex: 1 }}>
        <Label htmlFor="last-name">Last Name</Label>
        <InputContainer>
          <Input id="last-name" placeholder="Doe" />
        </InputContainer>
      </Utility>
    </Utility>

    {/* Pronouns */}
    <Utility vFlex vFlexCol vAlignItems="center" vGap={8}>
      <Label>Pronouns</Label>
      <Utility vFlex vFlexRow vGap={16}>
        {pronouns.map(p => (
          <Utility key={p} vAlignItems="center" vFlex vGap={4}>
            <Radio id={`pronoun-${p}`} name="pronouns" />
            <Label htmlFor={`pronoun-${p}`}>{p}</Label>
          </Utility>
        ))}
      </Utility>
    </Utility>

    {/* Email */}
    <Utility vFlex vFlexCol style={{ width: '100%' }}>
      <Label htmlFor="email">Email</Label>
      <InputContainer>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
        />
      </InputContainer>
    </Utility>

    {/* Age and Gender inline */}
    <Utility vFlex vFlexRow vGap={8} style={{ width: '100%' }}>
      <Utility vFlex vFlexCol style={{ flex: 1 }}>
        <Label htmlFor="age">Age</Label>
        <InputContainer>
          <Input id="age" type="number" placeholder="e.g. 30" />
        </InputContainer>
      </Utility>
      <Utility vFlex vFlexCol style={{ flex: 1 }}>
        <Label htmlFor="gender">Gender</Label>
        <InputContainer>
          <Select id="gender" name="gender" style={{ width: '100%' }}>
            <option hidden value="" />
            {genders.map(g => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
          <InputControl>
            <VisaChevronDownTiny />
          </InputControl>
        </InputContainer>
      </Utility>
    </Utility>

    {/* Mobile */}
    <Utility vFlex vFlexCol style={{ width: '100%' }}>
      <Label htmlFor="mobile">Mobile Number</Label>
      <InputContainer>
        <Input id="mobile" type="tel" placeholder="555-123-4567" />
      </InputContainer>
    </Utility>

    {/* Address */}
    <Utility vFlex vFlexCol style={{ width: '100%' }}>
      <Label htmlFor="address">Address</Label>
      <InputContainer>
        <Input id="address" placeholder="123 Main St" />
      </InputContainer>
    </Utility>

    {/* Submit */}
    <Utility vFlex vJustifyContent="center" style={{ width: '100%' }}>
      <Button buttonSize="large">Submit</Button>
    </Utility>
  </Utility>
);

export default UserProfilePreview;
