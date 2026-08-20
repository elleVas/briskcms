import type { ComponentConfig } from '@puckeditor/core';
import { mapEmbedPropsSchema, type MapEmbedProps } from '@brisk/shared-types';

export { mapEmbedPropsSchema, type MapEmbedProps };

export const mapEmbedConfig: ComponentConfig<MapEmbedProps> = {
  label: 'Mappa',
  fields: {
    address: { type: 'text', contentEditable: true, visible: false },
  },
  defaultProps: {
    // Non-empty, unlike `''`: contentEditable renders as an empty span with
    // zero width when the value is blank, with nothing left to click on to
    // start editing — same reasoning as rating.block.tsx's own non-empty
    // default.
    address: 'Via Roma 1, Milano',
  },
  // Canvas-only placeholder — never loads a live Google Maps iframe in the
  // editor (same "never execute third-party content in canvas" policy as
  // EmbedHtml/VideoEmbed). The real, GDPR-conscious click-to-load embed
  // only exists on apps/public-site (MapEmbed.astro).
  render: ({ address }) => (
    <div
      style={{
        border: '2px dashed #d4d4d8',
        borderRadius: 8,
        padding: 24,
        textAlign: 'center',
        color: '#71717a',
      }}
    >
      📍 {address || 'Nessun indirizzo impostato'}
    </div>
  ),
};
