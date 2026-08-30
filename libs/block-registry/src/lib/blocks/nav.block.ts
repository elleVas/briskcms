import type { NavProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';
import { visibilityField } from '../fields/visibility-field';

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
