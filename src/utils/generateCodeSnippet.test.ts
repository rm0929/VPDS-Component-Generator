import { describe, expect, it } from 'vitest';
import { generateCodeSnippet } from './generateCodeSnippet';
import { suggestComponents } from './suggestComponents';
import loginFormSource from '../components/LoginFormPreview.tsx?raw';
import cardFormSource from '../components/CardFormPreview.tsx?raw';
import signupFormSource from '../components/SignupFormPreview.tsx?raw';
import addressFormSource from '../components/AddressFormPreview.tsx?raw';
import userProfileSource from '../components/UserProfilePreview.tsx?raw';
import dateTimeSource from '../components/DateTimePreview.tsx?raw';
import tableSource from '../components/TablePreview.tsx?raw';
import notificationTraySource from '../components/NotificationTrayPreview.tsx?raw';
import modalSource from '../components/ModalPreview.tsx?raw';
import determinateProgressSource from '../components/DeterminateProgressPreview.tsx?raw';

const snippets: [string, string][] = [
  ['LoginForm', loginFormSource],
  ['CardForm', cardFormSource],
  ['SignupForm', signupFormSource],
  ['AddressForm', addressFormSource],
  ['UserProfile', userProfileSource],
  ['DateTime', dateTimeSource],
  ['Table', tableSource],
  ['NotificationTray', notificationTraySource],
  ['Modal', modalSource],
  ['DeterminateProgress', determinateProgressSource],
];

describe('generateCodeSnippet', () => {
  it.each(snippets)('returns the complete raw preview source for %s', (component, source) => {
    expect(source).toContain('export default');
    expect(generateCodeSnippet([component])).toBe(source);
  });

  it.each(snippets.slice(0, -1))('prioritizes %s over every lower-priority component', (component, source) => {
    const index = snippets.findIndex(([name]) => name === component);
    const lowerPriority = snippets.slice(index + 1).map(([name]) => name).reverse();
    expect(generateCodeSnippet([...lowerPriority, component])).toBe(source);
  });

  it.each([
    { components: [] },
    { components: ['Unknown'] },
    { components: ['UserProfileForm'] },
    { components: ['loginform'] },
  ])(
    'returns the fallback for unsupported input $components', ({ components }) => {
      expect(generateCodeSnippet(components)).toBe('// No matching component.');
    },
  );

  it('ignores unknown components and repeated selections', () => {
    expect(generateCodeSnippet(['Unknown', 'Table', 'Table'])).toBe(tableSource);
  });

  it('does not mutate the supplied component list', () => {
    const components = ['Modal', 'LoginForm'];
    generateCodeSnippet(components);
    expect(components).toEqual(['Modal', 'LoginForm']);
  });

  it('connects prompt suggestions to the selected source', () => {
    expect(generateCodeSnippet(suggestComponents('show a table and a LOGIN form'))).toBe(loginFormSource);
    expect(generateCodeSnippet(suggestComponents('build a navigation menu'))).toBe('// No matching component.');
  });
});
