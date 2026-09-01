import { FieldBuilder, type FieldDescriptor } from '../field-types';
import { PagePickerField } from './page-picker-field';

/**
 * Shared by every block with a "page or url" prop (NavLink, Button, Link,
 * Banner, PromoBar, PricingPlan) — drives which of `page`/`url` the
 * editor is actually filling in. Both fields always stay visible in the
 * Inspector (no conditional visibility for now), not just the chosen
 * one.
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
 * Security review 2026-08-24, point 16: `linkTypeField` + the page picker
 * + the URL field showed up copy-pasted identically across 6 blocks
 * (Banner, Button, Link, NavLink, PricingPlan, PromoBar) — a single
 * place they're derived from.
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
      // Found live during the i18n backfill (not just theorized): a real
      // site often uses this field for a hand-written relative internal
      // path (e.g. "/it/docs") instead of the actual PagePickerField — a
      // url like that MUST vary per language, it's not just an external
      // link that's "always the same everywhere". A genuinely external
      // url (rarely needs to differ per language) still stays editable
      // per-locale with this flag, minimal cost to avoid silently
      // breaking internal navigation.
      translatable: true,
    },
  ];
}
