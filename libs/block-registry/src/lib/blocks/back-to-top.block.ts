import type { BackToTopProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';
import { visibilityField } from '../fields/visibility-field';

export const backToTopBlock: BlockDescriptor<BackToTopProps> = {
  type: 'BackToTop',
  label: 'blocks.backToTop.label',
  category: 'chrome',
  defaultProps: { visibility: 'always' },
  fields: [visibilityField],
};
