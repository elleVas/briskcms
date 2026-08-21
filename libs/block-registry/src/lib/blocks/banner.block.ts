import type { BannerProps } from '@brisk/shared-types';
import { customField, type BlockDescriptor } from '../field-types.js';
import { ColorPickerField } from '../fields/color-picker-field.js';
import { linkTypeField } from '../fields/link-type-field.js';
import { PagePickerField } from '../fields/page-picker-field.js';

export const bannerBlock: BlockDescriptor<BannerProps> = {
  type: 'Banner',
  label: 'Banner/CTA',
  category: 'conversion',
  defaultProps: {
    title: 'Titolo del banner',
    text: 'Testo del banner...',
    buttonLabel: 'Scopri di più',
    linkType: 'page',
    page: null,
    url: '',
    backgroundColor: null,
  },
  fields: [
    { kind: 'text', key: 'title', label: 'Titolo', inlineEditable: true },
    { kind: 'textarea', key: 'text', label: 'Testo', inlineEditable: true },
    {
      kind: 'text',
      key: 'buttonLabel',
      label: 'Testo bottone',
      inlineEditable: true,
    },
    linkTypeField,
    customField('page', 'Pagina', PagePickerField),
    { kind: 'text', key: 'url', label: 'URL' },
    customField(
      'backgroundColor',
      'Colore di sfondo (sovrascrive il tema)',
      ColorPickerField,
    ),
  ],
};
