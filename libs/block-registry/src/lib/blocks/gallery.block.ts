import type { GalleryProps } from '@brisk/shared-types';
import { FieldBuilder, type BlockDescriptor } from '../field-types.js';
import { GalleryPickerField } from '../fields/gallery-picker-field.js';

export const galleryBlock: BlockDescriptor<GalleryProps> = {
  type: 'Gallery',
  label: 'Galleria',
  category: 'content',
  defaultProps: {
    images: [],
  },
  fields: [FieldBuilder.custom('images', 'Immagini', GalleryPickerField)],
};
