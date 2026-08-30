import type { LogoStripProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import { FieldBuilder, type BlockDescriptor } from '../field-types';
import { GalleryPickerField } from '../fields/gallery-picker-field';

export const logoStripBlock: BlockDescriptor<LogoStripProps> = {
  type: 'LogoStrip',
  label: 'blocks.logoStrip.label',
  category: 'media',
  defaultProps: {
    logos: [],
  },
  fields: [
    FieldBuilder.custom(
      'logos',
      'blocks.logoStrip.fields.logos.fieldLabel',
      GalleryPickerField,
    ),
  ],
  // Niente textColor: la striscia contiene solo immagini, nessun testo.
  stylableProperties: [
    'backgroundColor',
    'borderRadius',
    'paddingX',
    'paddingY',
  ],
  defaultStyle: BLOCK_STYLE_DEFAULTS.LogoStrip,
};
