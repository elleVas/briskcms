import type { FieldDescriptor } from '../field-types.js';

/**
 * Shared by ogni blocco con un prop `Visibility` (Nav, HamburgerMenu,
 * NavLink, LanguageSwitcher, Breadcrumb, SearchBox, BackToTop,
 * WhatsAppButton, PromoBar) così le opzioni non sono duplicate per blocco —
 * vedi visibilitySchema in @brisk/shared-types per cosa mappa ciascun
 * valore a render time (apps/public-site's visibility.css).
 */
export const visibilityField: FieldDescriptor = {
  kind: 'radio',
  key: 'visibility',
  label: 'blocks.shared.visibility.fieldLabel',
  options: [
    { label: 'blocks.shared.visibility.options.always', value: 'always' },
    {
      label: 'blocks.shared.visibility.options.desktopOnly',
      value: 'desktop-only',
    },
    {
      label: 'blocks.shared.visibility.options.mobileOnly',
      value: 'mobile-only',
    },
  ],
};
