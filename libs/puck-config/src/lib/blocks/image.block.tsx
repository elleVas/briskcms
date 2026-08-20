import type { ComponentConfig } from '@puckeditor/core';
import { imagePropsSchema, type ImageProps } from '@brisk/shared-types';
import { MediaPickerField } from '../fields/media-picker-field.js';

export { imagePropsSchema, type ImageProps };

export const imageConfig: ComponentConfig<ImageProps> = {
  label: 'Immagine',
  fields: {
    media: {
      type: 'custom',
      render: ({ value, onChange }) => (
        <MediaPickerField value={value} onChange={onChange} />
      ),
    },
    alt: { type: 'text' },
    caption: { type: 'text' },
  },
  defaultProps: {
    media: null,
    alt: '',
    caption: '',
  },
  render: ({ media, alt, caption }) => (
    <figure>
      {media ? (
        <img
          src={media.url}
          alt={alt}
          style={{ maxWidth: '100%', height: 'auto' }}
        />
      ) : (
        <div
          style={{
            border: '2px dashed #d4d4d8',
            borderRadius: 8,
            padding: 24,
            textAlign: 'center',
            color: '#71717a',
          }}
        >
          Nessuna immagine selezionata
        </div>
      )}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  ),
};
