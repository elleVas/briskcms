import type { PromoBarProps } from '@brisk/shared-types';
import { customField, type BlockDescriptor } from '../field-types.js';
import { ColorPickerField } from '../fields/color-picker-field.js';
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
    colorOverride: null,
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
    customField(
      'colorOverride',
      'Colore personalizzato (sovrascrive il tema)',
      ColorPickerField,
    ),
  ],
};
