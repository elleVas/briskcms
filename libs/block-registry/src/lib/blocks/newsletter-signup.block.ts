import type { NewsletterSignupProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';

export const newsletterSignupBlock: BlockDescriptor<NewsletterSignupProps> = {
  type: 'NewsletterSignup',
  label: 'Iscrizione newsletter',
  category: 'conversion',
  defaultProps: {
    title: 'Iscriviti alla newsletter',
    buttonLabel: 'Iscrivimi',
  },
  fields: [
    { kind: 'text', key: 'title', label: 'Titolo', inlineEditable: true },
    {
      kind: 'text',
      key: 'buttonLabel',
      label: 'Testo bottone',
      inlineEditable: true,
    },
  ],
};
