import type { ButtonProps } from '@brisk/shared-types';
import { customField, type BlockDescriptor } from '../field-types.js';
import { ColorPickerField } from '../fields/color-picker-field.js';
import { linkTypeField } from '../fields/link-type-field.js';
import { PagePickerField } from '../fields/page-picker-field.js';

export const buttonBlock: BlockDescriptor<ButtonProps> = {
  type: 'Button',
  label: 'Bottone (CTA)',
  category: 'conversion',
  defaultProps: {
    label: 'Scopri di più',
    linkType: 'page',
    page: null,
    url: '',
    variant: 'primary',
    colorOverride: null,
  },
  fields: [
    { kind: 'text', key: 'label', label: 'Testo', inlineEditable: true },
    linkTypeField,
    customField('page', 'Pagina', PagePickerField),
    { kind: 'text', key: 'url', label: 'URL' },
    {
      kind: 'radio',
      key: 'variant',
      label: 'Stile',
      options: [
        { label: 'Primario', value: 'primary' },
        { label: 'Secondario', value: 'secondary' },
      ],
    },
    customField(
      'colorOverride',
      'Colore personalizzato (sovrascrive il tema)',
      ColorPickerField,
    ),
  ],
};
