import type { NavProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';
import { visibilityField } from '../fields/visibility-field.js';

export const navBlock: BlockDescriptor<NavProps> = {
  type: 'Nav',
  label: 'blocks.nav.label',
  category: 'navigation',
  defaultProps: { visibility: 'always' },
  fields: [visibilityField],
  isContainer: true,
  allowedChildTypes: [
    'NavLink',
    'LanguageSwitcher',
    'HamburgerMenu',
    'NavDropdown',
  ],
};
