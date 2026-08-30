import type { GalleryProps } from '@brisk/shared-types';
import { FieldBuilder, type BlockDescriptor } from '../field-types';
import { GalleryPickerField } from '../fields/gallery-picker-field';

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
      GalleryPickerField,
    ),
  ],
};
