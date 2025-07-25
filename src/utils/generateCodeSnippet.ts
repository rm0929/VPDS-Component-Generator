// src/utils/generateCodeSnippet.ts
import loginFormSource from '../components/LoginFormPreview.tsx?raw';
import cardFormSource from '../components/CardFormPreview.tsx?raw';
import signupFormSource from '../components/SignupFormPreview.tsx?raw';
import addressFormSource from '../components/AddressFormPreview.tsx?raw';
import userProfileSource from '../components/UserProfilePreview.tsx?raw';
import dateTimeSource from '../components/DateTimePreview.tsx?raw';
import tableSource from '../components/TablePreview.tsx?raw';
import notificationTraySource from '../components/NotificationTrayPreview.tsx?raw';
import modalSource from '../components/ModalPreview.tsx?raw';
import determProgSource from '../components/DeterminateProgressPreview.tsx?raw';





export function generateCodeSnippet(
  components: string[]
): string {
  if (components.includes('LoginForm')) {
    return loginFormSource;
  }

  if (components.includes('CardForm')) {
    return cardFormSource;
  }
  if (components.includes('SignupForm')) {
    return signupFormSource;
  }
  if (components.includes('AddressForm')) {
    return addressFormSource;
  }
  if (components.includes('UserProfile')) {
    return userProfileSource;
  }
  if (components.includes('DateTime')) {
    return dateTimeSource;
  }
  if (components.includes('Table')) {
    return tableSource;
  }
  if (components.includes('NotificationTray')) {
    return notificationTraySource;
  }
  if (components.includes('Modal')) {
    return modalSource;
  }
  if (components.includes('DeterminateProgress')){ 
    return determProgSource;
  }
  // …existing cases…

  return `// No matching component.`;
}
