import type { BackToTopProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';
import { visibilityField } from '../fields/visibility-field.js';

export const backToTopBlock: BlockDescriptor<BackToTopProps> = {
  type: 'BackToTop',
  label: 'blocks.backToTop.label',
  category: 'chrome',
  defaultProps: { visibility: 'always' },
  fields: [visibilityField],
};
