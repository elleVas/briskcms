import type { TextProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';

export const textBlock: BlockDescriptor<TextProps> = {
  type: 'Text',
  label: 'Testo',
  category: 'content',
  defaultProps: {
    body: 'Testo del blocco...',
  },
  fields: [
    { kind: 'textarea', key: 'body', label: 'Testo', inlineEditable: true },
  ],
  stylableProperties: ['textColor'],
};
