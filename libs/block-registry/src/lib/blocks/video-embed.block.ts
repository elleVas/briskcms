import type { VideoEmbedProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import { FieldBuilder, type BlockDescriptor } from '../field-types';

export const videoEmbedBlock: BlockDescriptor<VideoEmbedProps> = {
  type: 'VideoEmbed',
  label: 'blocks.videoEmbed.label',
  category: 'media',
  defaultProps: {
    url: '',
    poster: null,
    aspectRatio: 'wide',
    caption: '',
  },
  fields: [
    {
      kind: 'text',
      key: 'url',
      label: 'blocks.videoEmbed.fields.url.fieldLabel',
      placeholder: 'https://www.youtube.com/watch?v=...',
    },
    FieldBuilder.custom(
      'poster',
      'blocks.videoEmbed.fields.poster.fieldLabel',
      'media',
    ),
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
      kind: 'text',
      key: 'caption',
      translatable: true,
      label: 'blocks.shared.caption.fieldLabel',
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
  defaultStyle: BLOCK_STYLE_DEFAULTS.VideoEmbed,
};
