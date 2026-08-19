import type { RadioField } from '@puckeditor/core';

/**
 * Shared by every block that has a `Visibility` prop (Nav, HamburgerMenu,
 * NavLink, LanguageSwitcher) so the radio options aren't duplicated per
 * block — see visibilitySchema in @brisk/shared-types for what each
 * value maps to at render time (apps/public-site's visibility.css).
 */
export const visibilityField: RadioField = {
  type: 'radio',
  label: 'Visibilità',
  options: [
    { label: 'Sempre', value: 'always' },
    { label: 'Solo desktop', value: 'desktop-only' },
    { label: 'Solo mobile', value: 'mobile-only' },
  ],
};
