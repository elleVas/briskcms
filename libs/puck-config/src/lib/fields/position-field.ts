import type { RadioField } from '@puckeditor/core';

/**
 * Shared by every block that has a `NavItemPosition` prop (NavLink,
 * LanguageSwitcher) so the radio options aren't duplicated per block —
 * see navItemPositionSchema in @brisk/shared-types for what "left"/"right"
 * mean at render time.
 */
export const positionField: RadioField = {
  type: 'radio',
  label: 'Posizione',
  options: [
    { label: 'Sinistra', value: 'left' },
    { label: 'Destra', value: 'right' },
  ],
};
