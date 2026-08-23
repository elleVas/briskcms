import type { QuoteProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';

export const quoteBlock: BlockDescriptor<QuoteProps> = {
  type: 'Quote',
  label: 'Citazione',
  category: 'content',
  defaultProps: {
    quote: 'Testo della citazione...',
    author: '',
    role: '',
  },
  fields: [
    {
      kind: 'textarea',
      key: 'quote',
      label: 'Citazione',
      inlineEditable: true,
    },
    { kind: 'text', key: 'author', label: 'Autore', inlineEditable: true },
    { kind: 'text', key: 'role', label: 'Ruolo', inlineEditable: true },
  ],
  stylableProperties: [
    'backgroundColor',
    'textColor',
    'borderRadius',
    'paddingX',
    'paddingY',
  ],
};
