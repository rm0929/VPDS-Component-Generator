// src/components/AddressFormPreview.tsx
import React, { useState } from 'react';
import {
  Utility,
  Label,
  InputContainer,
  Input,
  Select,
  InputControl,
  Button,
  InputMessage,
  UtilityFragment,
} from '@visa/nova-react';
import { VisaChevronDownTiny, VisaErrorTiny } from '@visa/nova-icons-react';

const countries = ['United States', 'Mexico', 'Canada', 'United Kingdom'];
const countryCodes = ['+1', '+52', '+1', '+44'];

const AddressFormPreview: React.FC = () => {
  // form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [country, setCountry] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [city, setCity] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [zip, setZip] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [phone, setPhone] = useState('');

  // error flags
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, boolean> = {};

    // validate required fields
    if (!firstName.trim()) newErrors.firstName = true;
    if (!lastName.trim())  newErrors.lastName = true;
    if (!country)          newErrors.country = true;
    if (!address1.trim())  newErrors.address1 = true;
    if (!city.trim())      newErrors.city = true;
    if (!stateVal.trim())  newErrors.stateVal = true;
    if (!zip.trim())       newErrors.zip = true;
    if (!countryCode)      newErrors.countryCode = true;
    if (!phone.trim())     newErrors.phone = true;

    setErrors(newErrors);

    // if no errors, you could proceed
    if (Object.keys(newErrors).length === 0) {
      alert('Form submitted successfully!');
      // reset or further logic here...
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Utility vFlex vFlexCol vGap={16} style={{ width: '100%', maxWidth: '400px' }}>
        {/* A. Name Fields Inline */}
        <Utility vFlex vFlexRow vGap={8}>
          <Utility style={{ width: '50%' }}>
            <Label htmlFor="first-name">First Name</Label>
            <InputContainer>
              <Input
                id="first-name"
                placeholder="John"
                value={firstName}
                onChange={e => setFirstName((e.target as HTMLInputElement).value)}
                aria-invalid={errors.firstName}
                aria-describedby={errors.firstName ? 'error-first-name' : undefined}
              />
            </InputContainer>
            {errors.firstName && (
              <UtilityFragment vMarginTop={4}>
                <InputMessage
                  id="error-first-name"
                  role="alert"
                  aria-atomic="true"
                  variant="body-3"
                >
                  <VisaErrorTiny /> First name is required
                </InputMessage>
              </UtilityFragment>
            )}
          </Utility>

          <Utility style={{ width: '50%' }}>
            <Label htmlFor="last-name">Last Name</Label>
            <InputContainer>
              <Input
                id="last-name"
                placeholder="Doe"
                value={lastName}
                onChange={e => setLastName((e.target as HTMLInputElement).value)}
                aria-invalid={errors.lastName}
                aria-describedby={errors.lastName ? 'error-last-name' : undefined}
              />
            </InputContainer>
            {errors.lastName && (
              <UtilityFragment vMarginTop={4}>
                <InputMessage
                  id="error-last-name"
                  role="alert"
                  aria-atomic="true"
                  variant="body-3"
                >
                  <VisaErrorTiny /> Last name is required
                </InputMessage>
              </UtilityFragment>
            )}
          </Utility>
        </Utility>

        {/* B. Country Field */}
        <Label htmlFor="country">Country</Label>
        <InputContainer>
          <Select
            id="country"
            name="country"
            value={country}
            onChange={e => setCountry((e.target as HTMLSelectElement).value)}
            aria-invalid={errors.country}
            aria-describedby={errors.country ? 'error-country' : undefined}
          >
            <option hidden value="">
              Select a country
            </option>
            {countries.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          <InputControl>
            <VisaChevronDownTiny />
          </InputControl>
        </InputContainer>
        {errors.country && (
          <UtilityFragment vMarginTop={4}>
            <InputMessage
              id="error-country"
              role="alert"
              aria-atomic="true"
              variant="body-3"
            >
              <VisaErrorTiny /> Country is required
            </InputMessage>
          </UtilityFragment>
        )}

        {/* C. Address Lines */}
        <Label htmlFor="address1">Address Line 1</Label>
        <InputContainer>
          <Input
            id="address1"
            placeholder="123 Main St"
            value={address1}
            onChange={e => setAddress1((e.target as HTMLInputElement).value)}
            aria-invalid={errors.address1}
            aria-describedby={errors.address1 ? 'error-address1' : undefined}
          />
        </InputContainer>
        {errors.address1 && (
          <UtilityFragment vMarginTop={4}>
            <InputMessage
              id="error-address1"
              role="alert"
              aria-atomic="true"
              variant="body-3"
            >
              <VisaErrorTiny /> Address Line 1 is required
            </InputMessage>
          </UtilityFragment>
        )}

        <Label htmlFor="address2">
          Address Line 2 <span style={{ color: 'var(--palette-default-text-subtle)' }}>(optional)</span>
        </Label>
        <InputContainer>
          <Input
            id="address2"
            placeholder="Apt, suite, etc."
            value={address2}
            onChange={e => setAddress2((e.target as HTMLInputElement).value)}
          />
        </InputContainer>

        {/* D. City, State, ZIP Inline */}
        <Utility vFlex vFlexRow vGap={8}>
          <Utility style={{ width: '40%' }}>
            <Label htmlFor="city">City</Label>
            <InputContainer>
              <Input
                id="city"
                placeholder="City"
                value={city}
                onChange={e => setCity((e.target as HTMLInputElement).value)}
                aria-invalid={errors.city}
                aria-describedby={errors.city ? 'error-city' : undefined}
              />
            </InputContainer>
            {errors.city && (
              <UtilityFragment vMarginTop={4}>
                <InputMessage
                  id="error-city"
                  role="alert"
                  aria-atomic="true"
                  variant="body-3"
                >
                  <VisaErrorTiny /> City is required
                </InputMessage>
              </UtilityFragment>
            )}
          </Utility>

          <Utility style={{ width: '30%' }}>
            <Label htmlFor="state">State</Label>
            <InputContainer>
              <Input
                id="state"
                placeholder="State"
                value={stateVal}
                onChange={e => setStateVal((e.target as HTMLInputElement).value)}
                aria-invalid={errors.stateVal}
                aria-describedby={errors.stateVal ? 'error-state' : undefined}
              />
            </InputContainer>
            {errors.stateVal && (
              <UtilityFragment vMarginTop={4}>
                <InputMessage
                  id="error-state"
                  role="alert"
                  aria-atomic="true"
                  variant="body-3"
                >
                  <VisaErrorTiny /> State is required
                </InputMessage>
              </UtilityFragment>
            )}
          </Utility>

          <Utility style={{ width: '30%' }}>
            <Label htmlFor="zip">ZIP Code</Label>
            <InputContainer>
              <Input
                id="zip"
                placeholder="ZIP"
                value={zip}
                onChange={e => setZip((e.target as HTMLInputElement).value)}
                aria-invalid={errors.zip}
                aria-describedby={errors.zip ? 'error-zip' : undefined}
              />
            </InputContainer>
            {errors.zip && (
              <UtilityFragment vMarginTop={4}>
                <InputMessage
                  id="error-zip"
                  role="alert"
                  aria-atomic="true"
                  variant="body-3"
                >
                  <VisaErrorTiny /> ZIP Code is required
                </InputMessage>
              </UtilityFragment>
            )}
          </Utility>
        </Utility>

        {/* E & F. Country Code & Phone Number Inline */}
        <Utility vFlex vFlexRow vAlignItems="end" vGap={8}>
          <Utility style={{ width: '35%' }}>
            <Label htmlFor="country-code">Country Code</Label>
            <InputContainer>
              <Select
                id="country-code"
                name="country-code"
                value={countryCode}
                onChange={e => setCountryCode((e.target as HTMLSelectElement).value)}
                aria-invalid={errors.countryCode}
                aria-describedby={errors.countryCode ? 'error-country-code' : undefined}
              >
                <option hidden value="">
                  Select code
                </option>
                {countryCodes.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
              <InputControl>
                <VisaChevronDownTiny />
              </InputControl>
            </InputContainer>
            {errors.countryCode && (
              <UtilityFragment vMarginTop={4}>
                <InputMessage
                  id="error-country-code"
                  role="alert"
                  aria-atomic="true"
                  variant="body-3"
                >
                  <VisaErrorTiny /> Country code is required
                </InputMessage>
              </UtilityFragment>
            )}
          </Utility>

          <Utility style={{ width: '65%' }}>
            <Label htmlFor="phone">Phone Number</Label>
            <InputContainer>
              <Input
                id="phone"
                type="tel"
                placeholder="555-123-4567"
                value={phone}
                onChange={e => setPhone((e.target as HTMLInputElement).value)}
                aria-invalid={errors.phone}
                aria-describedby={errors.phone ? 'error-phone' : undefined}
              />
            </InputContainer>
            {errors.phone && (
              <UtilityFragment vMarginTop={4}>
                <InputMessage
                  id="error-phone"
                  role="alert"
                  aria-atomic="true"
                  variant="body-3"
                >
                  <VisaErrorTiny /> Phone number is required
                </InputMessage>
              </UtilityFragment>
            )}
          </Utility>
        </Utility>

        {/* Submit */}
        <Button buttonSize="large" type="submit">Submit</Button>
      </Utility>
    </form>
  );
};

export default AddressFormPreview;
