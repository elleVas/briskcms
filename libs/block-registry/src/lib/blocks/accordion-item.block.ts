import type { AccordionItemProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';
import { BlockStyleRegistry } from '../block-style-registry';

export const accordionItemBlock: BlockDescriptor<AccordionItemProps> = {
  type: 'AccordionItem',
  label: 'blocks.accordionItem.label',
  category: 'interactive',
  defaultProps: {
    question: 'Domanda...',
    answer: 'Risposta...',
  },
  fields: [
    {
      kind: 'text',
      key: 'question',
      translatable: true,
      label: 'blocks.accordionItem.fields.question.fieldLabel',
      inlineEditable: true,
    },
    {
      kind: 'textarea',
      key: 'answer',
      translatable: true,
      label: 'blocks.accordionItem.fields.answer.fieldLabel',
      inlineEditable: true,
    },
  ],
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.AccordionItem,
};
