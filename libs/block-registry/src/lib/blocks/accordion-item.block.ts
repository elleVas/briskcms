import type { AccordionItemProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';
import { BlockStyleRegistry } from '../block-style-registry.js';

export const accordionItemBlock: BlockDescriptor<AccordionItemProps> = {
  type: 'AccordionItem',
  label: 'Domanda',
  category: 'interactive',
  defaultProps: {
    question: 'Domanda...',
    answer: 'Risposta...',
  },
  fields: [
    { kind: 'text', key: 'question', label: 'Domanda', inlineEditable: true },
    {
      kind: 'textarea',
      key: 'answer',
      label: 'Risposta',
      inlineEditable: true,
    },
  ],
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.AccordionItem,
};
