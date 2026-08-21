import type { LogoStripProps } from '@brisk/shared-types';
import { customField, type BlockDescriptor } from '../field-types.js';
import { GalleryPickerField } from '../fields/gallery-picker-field.js';

export const logoStripBlock: BlockDescriptor<LogoStripProps> = {
  type: 'LogoStrip',
  label: 'Loghi partner/clienti',
  category: 'media',
  defaultProps: {
    logos: [],
  },
  fields: [customField('logos', 'Loghi', GalleryPickerField)],
};
