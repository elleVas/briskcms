import type { ImageProps } from '@brisk/shared-types';
import { FieldBuilder, type BlockDescriptor } from '../field-types';
import { MediaPickerField } from '../fields/media-picker-field';

export const imageBlock: BlockDescriptor<ImageProps> = {
  type: 'Image',
  label: 'blocks.image.label',
  category: 'content',
  defaultProps: {
    media: null,
    alt: '',
    isDecorative: false,
    caption: '',
  },
  fields: [
    FieldBuilder.custom(
      'media',
      'blocks.image.fields.media.fieldLabel',
      MediaPickerField,
    ),
    // alt is not inlineEditable: it's an attribute (no visible text node
    // in the DOM), not content that can be edited on the canvas.
    {
      kind: 'text',
      key: 'alt',
      translatable: true,
      label: 'blocks.image.fields.alt.fieldLabel',
      required: true,
      requiredUnless: 'isDecorative',
    },
    {
      kind: 'boolean',
      key: 'isDecorative',
      label: 'blocks.image.fields.isDecorative.fieldLabel',
    },
    {
      kind: 'text',
      key: 'caption',
      translatable: true,
      label: 'blocks.image.fields.caption.fieldLabel',
      inlineEditable: true,
    },
  ],
};
