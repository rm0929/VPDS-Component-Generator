import React from 'react';
import {
  Utility,
  Label,
  InputContainer,
  Input,
  InputControl,
  Select,
} from '@visa/nova-react';
import { VisaChevronDownTiny, VisaCardGenericLow, VisaInformationTiny } from '@visa/nova-icons-react';

const CardFormPreview: React.FC = () => (
  <Utility vFlex vFlexCol vGap={16} style={{ width: '100%', maxWidth: '400px' }}>

    {/* Card Number */}
    <Label htmlFor="card-number">Card Number</Label>
    <InputContainer style={{ position: 'relative' }}>
      <Input
        id="card-number"
        type="text"
        placeholder="1234 5678 9012 3456"
        style={{ paddingRight: '2.5rem' }}
      />
      <InputControl style={{ right: '0.75rem' }}>
        <VisaCardGenericLow />
      </InputControl>
    </InputContainer>

    {/* Expiry (Month / Year) */}
    <Label>Expires (MM/YY)</Label>
    <Utility vFlex vAlignItems="center" vGap={8}>
      {/* Month */}
      <InputContainer style={{ position: 'relative', width: '25%' }}>
        <Select id="exp-month" name="exp-month" style={{ width: '100%' }}>
          <option hidden value="" />
          {[...Array(12)].map((_, i) => (
            <option key={i} value={i + 1}>
              {(i + 1).toString().padStart(2, '0')}
            </option>
          ))}
        </Select>
        <InputControl style={{ right: '0.5rem' }}>
            <VisaChevronDownTiny />
        </InputControl>
      </InputContainer>

      {/* Slash Separator */}
      <span style={{ fontSize: '1.25rem', lineHeight: '1', marginTop: '0.5rem' }}>/</span>

      {/* Year */}
      <InputContainer style={{ position: 'relative', width: '25%' }}>
        <Select id="exp-year" name="exp-year" style={{ width: '100%' }}>
          <option hidden value="" />
          {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i).map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </Select>
        <InputControl style={{ right: '0.5rem' }}>
            <VisaChevronDownTiny />
        </InputControl>
      </InputContainer>
    </Utility>

    {/* Security Code */}
    <Label htmlFor="security-code">Security Code</Label>
    <InputContainer style={{ position: 'relative', width: '25%' }}>
      <Input
        id="security-code"
        type="password"
        placeholder="•••"
        style={{ paddingRight: '2.5rem' }}
      />
      <InputControl style={{ right: '0.75rem' }}>
        <VisaInformationTiny aria-label="Security code information" />
      </InputControl>
    </InputContainer>
  </Utility>
);

export default CardFormPreview;
