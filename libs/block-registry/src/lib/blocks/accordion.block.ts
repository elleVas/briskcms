import type { AccordionProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';
import { BlockStyleRegistry } from '../block-style-registry.js';

export const accordionBlock: BlockDescriptor<AccordionProps> = {
  type: 'Accordion',
  label: 'blocks.accordion.label',
  category: 'interactive',
  defaultProps: {},
  fields: [],
  isContainer: true,
  allowedChildTypes: ['AccordionItem'],
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.Accordion,
};
