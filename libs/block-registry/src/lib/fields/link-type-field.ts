import { FieldBuilder, type FieldDescriptor } from '../field-types.js';
import { PagePickerField } from './page-picker-field.js';

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

/**
 * Security review 2026-08-24, point 16: `linkTypeField` + il picker pagina
 * + il campo URL comparivano copiati identici in 6 blocchi (Banner, Button,
 * Link, NavLink, PricingPlan, PromoBar) — un solo punto da cui derivano.
 */
export function ctaLinkFields(): FieldDescriptor[] {
  return [
    linkTypeField,
    FieldBuilder.custom('page', 'Pagina', PagePickerField),
    { kind: 'text', key: 'url', label: 'URL' },
  ];
}
