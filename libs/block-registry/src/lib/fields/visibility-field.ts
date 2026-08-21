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
  label: 'Visibilità',
  options: [
    { label: 'Sempre', value: 'always' },
    { label: 'Solo desktop', value: 'desktop-only' },
    { label: 'Solo mobile', value: 'mobile-only' },
  ],
};
