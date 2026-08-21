import type { BackToTopProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';
import { visibilityField } from '../fields/visibility-field.js';

export const backToTopBlock: BlockDescriptor<BackToTopProps> = {
  type: 'BackToTop',
  label: 'Bottone "torna su"',
  category: 'chrome',
  defaultProps: { visibility: 'always' },
  fields: [visibilityField],
};
