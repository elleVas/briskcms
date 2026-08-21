import type { VideoEmbedProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';

export const videoEmbedBlock: BlockDescriptor<VideoEmbedProps> = {
  type: 'VideoEmbed',
  label: 'Video',
  category: 'media',
  defaultProps: {
    url: '',
  },
  fields: [
    {
      kind: 'text',
      key: 'url',
      label: 'URL video',
      placeholder: 'https://www.youtube.com/watch?v=...',
    },
  ],
};
