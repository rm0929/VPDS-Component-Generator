import { describe, expect, it } from 'vitest';
import { suggestComponents } from './suggestComponents';

describe('suggestComponents', () => {
  it.each([
    ['login form with remember me', 'LoginForm'],
    ['credit card details form', 'CardForm'],
    ['card number entry', 'CardForm'],
    ['signup', 'SignupForm'],
    ['sign up', 'SignupForm'],
    ['address form with city, state and zip', 'AddressForm'],
    ['responsive user profile form', 'UserProfile'],
    ['set date and time', 'DateTime'],
    ['set date', 'DateTime'],
    ['set time', 'DateTime'],
    ['show data table with rows and columns', 'Table'],
    ['open notifications panel', 'NotificationTray'],
    ['open modal', 'Modal'],
    ['open dialog', 'Modal'],
    ['determinate linear progress', 'DeterminateProgress'],
  ])('maps "%s" to %s without duplicates', (input, component) => {
    expect(suggestComponents(input)).toEqual([component]);
  });

  it('matches case-insensitively within surrounding text and whitespace', () => {
    expect(suggestComponents('  Please show a LOGIN form!  ')).toEqual(['LoginForm']);
  });

  it.each(['', '   ', 'build a navigation menu'])('returns no matches for "%s"', input => {
    expect(suggestComponents(input)).toEqual([]);
  });

  it('returns multiple matches in rule order, regardless of prompt order', () => {
    expect(suggestComponents('progress, notifications, table, address, signup, card input, login'))
      .toEqual(['LoginForm', 'CardForm', 'SignupForm', 'AddressForm', 'Table', 'NotificationTray', 'DeterminateProgress']);
  });

  it('deduplicates repeated and overlapping keywords', () => {
    expect(suggestComponents('login login with remember me, date and time, set time, data table with rows'))
      .toEqual(['LoginForm', 'DateTime', 'Table']);
  });

  // Characterize current limitations without changing Phase 0 behavior.
  it('matches substrings rather than whole words', () => {
    expect(suggestComponents('timetable')).toEqual(['DateTime', 'Table']);
  });

  it('retains the currently unsupported avatar-profile alias', () => {
    expect(suggestComponents('profile form with avatar')).toEqual(['UserProfile', 'UserProfileForm']);
  });
});
