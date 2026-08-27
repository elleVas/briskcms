import type { TextProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';

export const textBlock: BlockDescriptor<TextProps> = {
  type: 'Text',
  label: 'blocks.text.label',
  category: 'content',
  defaultProps: {
    body: 'Testo del blocco...',
  },
  fields: [
    {
      kind: 'textarea',
      key: 'body',
      label: 'blocks.text.fields.body.fieldLabel',
      inlineEditable: true,
    },
  ],
  stylableProperties: ['textColor'],
  defaultStyle: BLOCK_STYLE_DEFAULTS.Text,
};
