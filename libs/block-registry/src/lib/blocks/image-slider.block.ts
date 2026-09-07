import type { ImageSliderProps } from '@brisk/shared-types';
import { FieldBuilder, type BlockDescriptor } from '../field-types';

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
      'gallery',
    ),
  ],
};
