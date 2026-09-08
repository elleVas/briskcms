import type { GalleryProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import { FieldBuilder, type BlockDescriptor } from '../field-types';
import { BlockStyleRegistry } from '../block-style-registry';

export const galleryBlock: BlockDescriptor<GalleryProps> = {
  type: 'Gallery',
  label: 'blocks.gallery.label',
  category: 'content',
  defaultProps: {
    images: [],
  },
  fields: [
    FieldBuilder.custom(
      'images',
      'blocks.gallery.fields.images.fieldLabel',
      'gallery',
    ),
  ],
  stylableProperties: [...BlockStyleRegistry.STANDARD, 'gap'],
  defaultStyle: BLOCK_STYLE_DEFAULTS.Gallery,
};
