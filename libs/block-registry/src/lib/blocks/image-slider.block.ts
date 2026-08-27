import type { ImageSliderProps } from '@brisk/shared-types';
import { FieldBuilder, type BlockDescriptor } from '../field-types.js';
import { GalleryPickerField } from '../fields/gallery-picker-field.js';

export const imageSliderBlock: BlockDescriptor<ImageSliderProps> = {
  type: 'ImageSlider',
  label: 'blocks.imageSlider.label',
  category: 'media',
  defaultProps: {
    images: [],
  },
  fields: [
    FieldBuilder.custom(
      'images',
      'blocks.imageSlider.fields.images.fieldLabel',
      GalleryPickerField,
    ),
  ],
};
