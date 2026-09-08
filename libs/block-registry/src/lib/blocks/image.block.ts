import type { ImageProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import { FieldBuilder, type BlockDescriptor } from '../field-types';

export const imageBlock: BlockDescriptor<ImageProps> = {
  type: 'Image',
  label: 'blocks.image.label',
  category: 'content',
  defaultProps: {
    media: null,
    alt: '',
    isDecorative: false,
    caption: '',
    linkType: 'none',
    page: null,
    url: '',
    lightbox: false,
    alignment: 'center',
    aspectRatio: 'original',
  },
  fields: [
    FieldBuilder.custom(
      'media',
      'blocks.image.fields.media.fieldLabel',
      'media',
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
    {
      kind: 'select',
      key: 'alignment',
      label: 'blocks.shared.alignment.fieldLabel',
      options: [
        { label: 'blocks.shared.alignment.options.start', value: 'start' },
        { label: 'blocks.shared.alignment.options.center', value: 'center' },
        { label: 'blocks.shared.alignment.options.end', value: 'end' },
      ],
    },
    {
      kind: 'select',
      key: 'aspectRatio',
      label: 'blocks.shared.aspectRatio.fieldLabel',
      options: [
        {
          label: 'blocks.shared.aspectRatio.options.original',
          value: 'original',
        },
        { label: 'blocks.shared.aspectRatio.options.square', value: 'square' },
        {
          label: 'blocks.shared.aspectRatio.options.landscape',
          value: 'landscape',
        },
        {
          label: 'blocks.shared.aspectRatio.options.portrait',
          value: 'portrait',
        },
        { label: 'blocks.shared.aspectRatio.options.wide', value: 'wide' },
      ],
    },
    {
      kind: 'select',
      key: 'linkType',
      label: 'blocks.image.fields.linkType.fieldLabel',
      options: [
        { label: 'blocks.image.fields.linkType.options.none', value: 'none' },
        { label: 'blocks.image.fields.linkType.options.page', value: 'page' },
        { label: 'blocks.image.fields.linkType.options.url', value: 'url' },
      ],
    },
    FieldBuilder.custom(
      'page',
      'blocks.shared.linkType.pageFieldLabel',
      'page',
    ),
    {
      kind: 'text',
      key: 'url',
      label: 'blocks.shared.linkType.urlFieldLabel',
      placeholder: 'https://',
    },
    {
      kind: 'boolean',
      key: 'lightbox',
      label: 'blocks.image.fields.lightbox.fieldLabel',
    },
  ],
  stylableProperties: [
    'borderRadius',
    'borderWidth',
    'borderStyle',
    'borderColor',
    'boxShadow',
    'maxWidth',
  ],
  defaultStyle: BLOCK_STYLE_DEFAULTS.Image,
};
