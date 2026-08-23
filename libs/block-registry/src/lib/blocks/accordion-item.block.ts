import type { AccordionItemProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';

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
  stylableProperties: [
    'backgroundColor',
    'textColor',
    'borderRadius',
    'paddingX',
    'paddingY',
  ],
};
