import type { ImageProps } from '@brisk/shared-types';
import { customField, type BlockDescriptor } from '../field-types.js';
import { MediaPickerField } from '../fields/media-picker-field.js';

export const imageBlock: BlockDescriptor<ImageProps> = {
  type: 'Image',
  label: 'Immagine',
  category: 'content',
  defaultProps: {
    media: null,
    alt: '',
    caption: '',
  },
  fields: [
    customField('media', 'Immagine', MediaPickerField),
    // alt non è inlineEditable: è un attributo (nessun nodo di testo
    // visibile nel DOM), non un contenuto che si possa editare sul canvas.
    { kind: 'text', key: 'alt', label: 'Testo alternativo' },
    { kind: 'text', key: 'caption', label: 'Didascalia', inlineEditable: true },
  ],
};
