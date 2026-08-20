import type { ComponentConfig } from '@puckeditor/core';
import {
  videoEmbedPropsSchema,
  type VideoEmbedProps,
} from '@brisk/shared-types';

export { videoEmbedPropsSchema, type VideoEmbedProps };

export const videoEmbedConfig: ComponentConfig<VideoEmbedProps> = {
  label: 'Video',
  fields: {
    // Not contentEditable: a URL isn't rendered as page content on canvas
    // or on the public site (the visible piece is the click-to-load
    // button, built from it) — same treatment as every other url field
    // in this codebase (NavLink, Banner, ...).
    url: { type: 'text', placeholder: 'https://www.youtube.com/watch?v=...' },
  },
  defaultProps: {
    url: '',
  },
  // Canvas-only placeholder — never embeds a live YouTube/Vimeo player in
  // the editor (same "never execute third-party content in canvas" policy
  // as EmbedHtml). The real, GDPR-conscious click-to-load embed only
  // exists on apps/public-site (VideoEmbed.astro).
  render: ({ url }) => (
    <div
      style={{
        border: '2px dashed #d4d4d8',
        borderRadius: 8,
        padding: 24,
        textAlign: 'center',
        color: '#71717a',
      }}
    >
      {url ? `Video: ${url}` : 'Nessun video impostato'}
    </div>
  ),
};
