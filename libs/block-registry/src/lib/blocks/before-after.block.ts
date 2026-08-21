import type { BeforeAfterProps } from '@brisk/shared-types';
import { customField, type BlockDescriptor } from '../field-types.js';
import { MediaPickerField } from '../fields/media-picker-field.js';

export const beforeAfterBlock: BlockDescriptor<BeforeAfterProps> = {
  type: 'BeforeAfter',
  label: 'Prima/dopo',
  category: 'media',
  defaultProps: {
    beforeImage: null,
    afterImage: null,
    beforeLabel: 'Prima',
    afterLabel: 'Dopo',
  },
  fields: [
    customField('beforeImage', 'Immagine "prima"', MediaPickerField),
    customField('afterImage', 'Immagine "dopo"', MediaPickerField),
    {
      kind: 'text',
      key: 'beforeLabel',
      label: 'Etichetta "prima"',
      inlineEditable: true,
    },
    {
      kind: 'text',
      key: 'afterLabel',
      label: 'Etichetta "dopo"',
      inlineEditable: true,
    },
  ],
};
