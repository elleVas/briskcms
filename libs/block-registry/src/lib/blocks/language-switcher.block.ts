import type { LanguageSwitcherProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';
import { positionField } from '../fields/position-field';
import { visibilityField } from '../fields/visibility-field';

export const languageSwitcherBlock: BlockDescriptor<LanguageSwitcherProps> = {
  type: 'LanguageSwitcher',
  label: 'blocks.languageSwitcher.label',
  category: 'navigation',
  defaultProps: { position: 'left', visibility: 'always' },
  fields: [positionField, visibilityField],
};
