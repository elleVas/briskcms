import type { QuoteProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';
import { BlockStyleRegistry } from '../block-style-registry.js';

export const quoteBlock: BlockDescriptor<QuoteProps> = {
  type: 'Quote',
  label: 'blocks.quote.label',
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
      label: 'blocks.quote.fields.quote.fieldLabel',
      inlineEditable: true,
    },
    {
      kind: 'text',
      key: 'author',
      label: 'blocks.quote.fields.author.fieldLabel',
      inlineEditable: true,
    },
    {
      kind: 'text',
      key: 'role',
      label: 'blocks.quote.fields.role.fieldLabel',
      inlineEditable: true,
    },
  ],
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.Quote,
};
