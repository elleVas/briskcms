import { FieldBuilder, type FieldDescriptor } from '../field-types';
import { PagePickerField } from './page-picker-field';

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
  label: 'blocks.shared.linkType.fieldLabel',
  options: [
    { label: 'blocks.shared.linkType.options.page', value: 'page' },
    { label: 'blocks.shared.linkType.options.url', value: 'url' },
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
    FieldBuilder.custom(
      'page',
      'blocks.shared.linkType.pageFieldLabel',
      PagePickerField,
    ),
    {
      kind: 'text',
      key: 'url',
      label: 'blocks.shared.linkType.urlFieldLabel',
      // Trovato dal vivo durante il backfill i18n (non solo teorizzato):
      // un sito reale usa spesso questo campo per un percorso interno
      // relativo scritto a mano (es. "/it/docs") invece del PagePickerField
      // vero e proprio — un url del genere DEVE variare per lingua, non è
      // solo un link esterno "sempre uguale ovunque". Un vero url esterno
      // (raro il bisogno di differenziarlo per lingua) resta comunque
      // modificabile per-locale con questo flag, costo minimo per evitare
      // di rompere silenziosamente la navigazione interna.
      translatable: true,
    },
  ];
}
