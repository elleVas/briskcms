import type { ImageSliderProps } from '@brisk/shared-types';
import { customField, type BlockDescriptor } from '../field-types.js';
import { GalleryPickerField } from '../fields/gallery-picker-field.js';

export const imageSliderBlock: BlockDescriptor<ImageSliderProps> = {
  type: 'ImageSlider',
  label: 'Slider immagini',
  category: 'media',
  defaultProps: {
    images: [],
  },
  fields: [customField('images', 'Immagini', GalleryPickerField)],
};
