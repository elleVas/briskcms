import type { LogoStripProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import { FieldBuilder, type BlockDescriptor } from '../field-types';

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
      'gallery',
    ),
  ],
  // No textColor: the strip only contains images, no text.
  stylableProperties: [
    'backgroundColor',
    'borderRadius',
    'paddingX',
    'paddingY',
  ],
  defaultStyle: BLOCK_STYLE_DEFAULTS.LogoStrip,
};
