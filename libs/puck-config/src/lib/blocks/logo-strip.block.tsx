import type { ComponentConfig } from '@puckeditor/core';
import {
  logoStripPropsSchema,
  type LogoStripProps,
  type PickedMedia,
} from '@brisk/shared-types';
import { GalleryPickerField } from '../fields/gallery-picker-field.js';

export { logoStripPropsSchema, type LogoStripProps };

type LogoItem = LogoStripProps['logos'][number];

function isPictured(logo: LogoItem): logo is LogoItem & { media: PickedMedia } {
  return logo.media !== null;
}

export const logoStripConfig: ComponentConfig<LogoStripProps> = {
  label: 'Loghi partner/clienti',
  fields: {
    logos: {
      type: 'custom',
      render: ({ value, onChange }) => (
        <GalleryPickerField value={value} onChange={onChange} />
      ),
    },
  },
  defaultProps: {
    logos: [],
  },
  render: ({ logos }) => {
    const pictured = logos.filter(isPictured);
    if (pictured.length === 0) {
      return (
        <div
          style={{
            border: '2px dashed #d4d4d8',
            borderRadius: 8,
            padding: 24,
            textAlign: 'center',
            color: '#71717a',
          }}
        >
          Nessun logo aggiunto
        </div>
      );
    }
    return (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        {pictured.map((logo, index) => (
          <img
            key={logo.media.mediaId + index}
            src={logo.media.url}
            alt={logo.alt}
            style={{ maxWidth: '100%', height: 40, width: 'auto' }}
          />
        ))}
      </div>
    );
  },
};
