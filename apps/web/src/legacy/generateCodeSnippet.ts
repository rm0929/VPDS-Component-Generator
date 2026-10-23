import loginFormSource from './previews/LoginFormPreview.tsx?raw';
import cardFormSource from './previews/CardFormPreview.tsx?raw';
import signupFormSource from './previews/SignupFormPreview.tsx?raw';
import addressFormSource from './previews/AddressFormPreview.tsx?raw';
import userProfileSource from './previews/UserProfilePreview.tsx?raw';
import dateTimeSource from './previews/DateTimePreview.tsx?raw';
import tableSource from './previews/TablePreview.tsx?raw';
import notificationTraySource from './previews/NotificationTrayPreview.tsx?raw';
import modalSource from './previews/ModalPreview.tsx?raw';
import determProgSource from './previews/DeterminateProgressPreview.tsx?raw';





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

  return `// No matching component.`;
}
