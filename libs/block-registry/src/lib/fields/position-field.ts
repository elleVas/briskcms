import type { FieldDescriptor } from '../field-types.js';

/**
 * Shared by every block che ha un prop `NavItemPosition` (NavLink,
 * LanguageSwitcher, HamburgerMenu, NavDropdown) così le opzioni non sono
 * duplicate per blocco — vedi navItemPositionSchema in @brisk/shared-types
 * per cosa significano "left"/"right" a render time.
 */
export const positionField: FieldDescriptor = {
  kind: 'radio',
  key: 'position',
  label: 'Posizione',
  options: [
    { label: 'Sinistra', value: 'left' },
    { label: 'Destra', value: 'right' },
  ],
};
