import registration from '../../src/specification/fixtures/registration-form.json';
import { ApiError } from './errors';
import type { GenerationProvider } from './provider';

export const MOCK_PROMPTS = ['registration form', 'create a registration form', 'contact form', 'create a contact form'] as const;

/** Exact examples after case/whitespace normalization. No AI or fuzzy inference. */
export const mockProvider: GenerationProvider = {
  id: 'deterministic-mock', isMock: true,
  async generate(prompt, { signal }) {
    signal.throwIfAborted();
    const normalized = prompt.trim().toLowerCase().replace(/\s+/g, ' ');
    if (normalized === 'registration form' || normalized === 'create a registration form') {
      return structuredClone(registration);
    }
    if (normalized === 'contact form' || normalized === 'create a contact form') {
      return {
        version: '1.0', root: {
          id: 'contact-form', type: 'form', props: { label: 'Contact us' }, children: [{
            id: 'contact-fields', type: 'verticalLayout', props: { gap: 'medium' }, children: [
              { id: 'contact-title', type: 'heading', props: { content: 'Contact us', level: 2 } },
              { id: 'contact-name', type: 'textInput', props: { name: 'name', label: 'Name', required: true } },
              { id: 'contact-email', type: 'emailInput', props: { name: 'email', label: 'Email', required: true } },
              { id: 'contact-message', type: 'textInput', props: { name: 'message', label: 'Message', required: true, maxLength: 1000 } },
              { id: 'contact-submit', type: 'button', props: { label: 'Send message', type: 'submit' } },
            ],
          }],
        },
      };
    }
    throw new ApiError('UNSUPPORTED_PROMPT');
  },
};
