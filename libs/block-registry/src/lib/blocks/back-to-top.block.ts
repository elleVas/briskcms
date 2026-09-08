import type { BackToTopProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';
import { visibilityField } from '../fields/visibility-field';

export const backToTopBlock: BlockDescriptor<BackToTopProps> = {
  type: 'BackToTop',
  label: 'blocks.backToTop.label',
  category: 'chrome',
  defaultProps: { visibility: 'always' },
  fields: [visibilityField],
  stylableProperties: [
    'backgroundColor',
    'textColor',
    'borderRadius',
    'boxShadow',
  ],
  defaultStyle: BLOCK_STYLE_DEFAULTS.BackToTop,
};
