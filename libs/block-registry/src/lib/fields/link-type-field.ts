import type { FieldDescriptor } from '../field-types.js';

/**
 * Shared da ogni blocco con un prop "page o url" (NavLink, Button, Link,
 * Banner, PromoBar, PricingPlan) — guida quale tra `page`/`url` l'editor
 * sta effettivamente compilando. Entrambi i campi restano sempre visibili
 * nell'Inspector (niente visibilità condizionale per ora), non solo quello
 * scelto.
 */
export const linkTypeField: FieldDescriptor = {
  kind: 'radio',
  key: 'linkType',
  label: 'Tipo di link',
  options: [
    { label: 'Pagina del sito', value: 'page' },
    { label: 'URL esterno', value: 'url' },
  ],
};
