import type { ButtonProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';
import { BlockStyleRegistry } from '../block-style-registry.js';
import { ctaLinkFields } from '../fields/link-type-field.js';

export const buttonBlock: BlockDescriptor<ButtonProps> = {
  type: 'Button',
  label: 'blocks.button.label',
  category: 'conversion',
  defaultProps: {
    label: 'Scopri di più',
    linkType: 'page',
    page: null,
    url: '',
    variant: 'primary',
  },
  fields: [
    {
      kind: 'text',
      key: 'label',
      label: 'blocks.button.fields.label.fieldLabel',
      inlineEditable: true,
    },
    ...ctaLinkFields(),
    {
      kind: 'radio',
      key: 'variant',
      label: 'blocks.button.fields.variant.fieldLabel',
      options: [
        {
          label: 'blocks.button.fields.variant.options.primary',
          value: 'primary',
        },
        {
          label: 'blocks.button.fields.variant.options.secondary',
          value: 'secondary',
        },
      ],
    },
  ],
  // Colore/bordi/padding — editabili per TUTTI i Button del sito (pulsante
  // "Stile" nella toolbar) o solo per questa istanza (popover sul blocco
  // selezionato), docs/adr/0022. Sostituisce il vecchio `colorOverride`.
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.Button,
};
