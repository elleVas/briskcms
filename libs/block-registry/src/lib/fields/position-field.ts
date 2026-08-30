import type { FieldDescriptor } from '../field-types';

/**
 * Shared by every block che ha un prop `NavItemPosition` (NavLink,
 * LanguageSwitcher, HamburgerMenu, NavDropdown) così le opzioni non sono
 * duplicate per blocco — vedi navItemPositionSchema in @brisk/shared-types
 * per cosa significano "left"/"right" a render time.
 */
export const positionField: FieldDescriptor = {
  kind: 'radio',
  key: 'position',
  label: 'blocks.shared.position.fieldLabel',
  options: [
    { label: 'blocks.shared.position.options.left', value: 'left' },
    { label: 'blocks.shared.position.options.right', value: 'right' },
  ],
};
