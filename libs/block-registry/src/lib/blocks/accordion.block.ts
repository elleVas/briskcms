import type { AccordionProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';

export const accordionBlock: BlockDescriptor<AccordionProps> = {
  type: 'Accordion',
  label: 'Accordion/FAQ',
  category: 'interactive',
  defaultProps: {},
  fields: [],
  isContainer: true,
  allowedChildTypes: ['AccordionItem'],
  stylableProperties: [
    'backgroundColor',
    'textColor',
    'borderRadius',
    'paddingX',
    'paddingY',
  ],
};
