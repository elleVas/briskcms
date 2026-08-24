import type { ButtonProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import { customField, type BlockDescriptor } from '../field-types.js';
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
  ],
  // Colore/bordi/padding — editabili per TUTTI i Button del sito (pulsante
  // "Stile" nella toolbar) o solo per questa istanza (popover sul blocco
  // selezionato), docs/adr/0022. Sostituisce il vecchio `colorOverride`.
  stylableProperties: [
    'backgroundColor',
    'textColor',
    'borderRadius',
    'paddingX',
    'paddingY',
  ],
  defaultStyle: BLOCK_STYLE_DEFAULTS.Button,
};
