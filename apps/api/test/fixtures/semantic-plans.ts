import type { SupportedSemanticUiPlan } from '../../src/ai/compatibility/semanticUiPlan';

// Test inputs only. No production prompt-to-plan lookup exists.
export function profilePlan(): SupportedSemanticUiPlan {
  return {
    planVersion: '1', status: 'supported',
    elements: [
      { type: 'textInput', props: { label: 'First name', required: false, disabled: false, maxLength: 80 } },
      { type: 'textInput', props: { label: 'Last name', required: true } },
      { type: 'emailInput', props: { label: 'Email', placeholder: 'you@example.com' } },
      { type: 'button', props: { label: 'Save Profile', type: 'submit', disabled: false } },
    ],
    groups: [
      { kind: 'form', props: { label: 'Profile' }, members: [{ group: 1 }, { element: 2 }, { element: 3 }] },
      { kind: 'row', props: { gap: 'small' }, members: [{ element: 0 }, { element: 1 }] },
    ],
    content: [{ group: 0 }],
  };
}

export function allTypesPlan(): SupportedSemanticUiPlan {
  return {
    planVersion: '1', status: 'supported',
    elements: [
      { type: 'textInput', props: { label: 'Name' } },
      { type: 'emailInput', props: { label: 'Email', required: true } },
      { type: 'passwordInput', props: { label: 'Password', disabled: false } },
      { type: 'checkbox', props: { label: 'Updates', required: false } },
      { type: 'button', props: { label: 'Save', type: 'submit' } },
      { type: 'text', props: { content: 'Your preferences' } },
      { type: 'heading', props: { content: 'Preferences', level: 2 } },
    ],
    groups: [
      { kind: 'row', props: { gap: 'large' }, members: [{ element: 0 }, { element: 1 }] },
      { kind: 'column', props: { gap: 'none' }, members: [{ group: 0 }, { element: 2 }, { element: 3 }, { element: 4 }] },
      { kind: 'form', props: { label: 'Preferences' }, members: [{ group: 1 }] },
    ],
    content: [{ element: 6 }, { element: 5 }, { group: 2 }],
  };
}
