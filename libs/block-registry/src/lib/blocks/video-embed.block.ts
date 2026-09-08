import type { VideoEmbedProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';

export const videoEmbedBlock: BlockDescriptor<VideoEmbedProps> = {
  type: 'VideoEmbed',
  label: 'blocks.videoEmbed.label',
  category: 'media',
  defaultProps: {
    url: '',
  },
  fields: [
    {
      kind: 'text',
      key: 'url',
      label: 'blocks.videoEmbed.fields.url.fieldLabel',
      placeholder: 'https://www.youtube.com/watch?v=...',
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
