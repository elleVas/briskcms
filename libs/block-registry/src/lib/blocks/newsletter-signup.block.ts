import type { NewsletterSignupProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';

export const newsletterSignupBlock: BlockDescriptor<NewsletterSignupProps> = {
  type: 'NewsletterSignup',
  label: 'blocks.newsletterSignup.label',
  category: 'conversion',
  defaultProps: {
    title: 'Iscriviti alla newsletter',
    buttonLabel: 'Iscrivimi',
  },
  fields: [
    {
      kind: 'text',
      key: 'title',
      translatable: true,
      label: 'blocks.newsletterSignup.fields.title.fieldLabel',
      inlineEditable: true,
    },
    {
      kind: 'text',
      key: 'buttonLabel',
      translatable: true,
      label: 'blocks.newsletterSignup.fields.buttonLabel.fieldLabel',
      inlineEditable: true,
    },
  ],
};
