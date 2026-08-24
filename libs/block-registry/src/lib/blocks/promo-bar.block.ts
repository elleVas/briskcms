import type { PromoBarProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import { customField, type BlockDescriptor } from '../field-types.js';
import { linkTypeField } from '../fields/link-type-field.js';
import { PagePickerField } from '../fields/page-picker-field.js';
import { visibilityField } from '../fields/visibility-field.js';

export const promoBarBlock: BlockDescriptor<PromoBarProps> = {
  type: 'PromoBar',
  label: 'Barra annuncio/promo',
  category: 'chrome',
  defaultProps: {
    message: 'Messaggio promozionale...',
    linkType: 'page',
    page: null,
    url: '',
    visibility: 'always',
  },
  fields: [
    {
      kind: 'textarea',
      key: 'message',
      label: 'Messaggio',
      inlineEditable: true,
    },
    linkTypeField,
    customField('page', 'Pagina', PagePickerField),
    { kind: 'text', key: 'url', label: 'URL' },
    visibilityField,
  ],
  // Sostituisce il vecchio `colorOverride` — vedi button.block.ts.
  stylableProperties: [
    'backgroundColor',
    'textColor',
    'borderRadius',
    'paddingX',
    'paddingY',
  ],
  defaultStyle: BLOCK_STYLE_DEFAULTS.PromoBar,
};
