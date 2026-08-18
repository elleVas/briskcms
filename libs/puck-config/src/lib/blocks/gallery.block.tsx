import type { ComponentConfig } from '@puckeditor/core';
import {
  galleryPropsSchema,
  type GalleryProps,
  type PickedMedia,
} from '@brisk/shared-types';
import { GalleryPickerField } from '../fields/gallery-picker-field.js';

export { galleryPropsSchema, type GalleryProps };

type GalleryImage = GalleryProps['images'][number];

function isPictured(
  image: GalleryImage,
): image is GalleryImage & { media: PickedMedia } {
  return image.media !== null;
}

export const galleryConfig: ComponentConfig<GalleryProps> = {
  label: 'Galleria',
  fields: {
    images: {
      type: 'custom',
      render: ({ value, onChange }) => (
        <GalleryPickerField value={value} onChange={onChange} />
      ),
    },
  },
  defaultProps: {
    images: [],
  },
  render: ({ images }) => {
    const pictured = images.filter(isPictured);
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
          Nessuna immagine nella galleria
        </div>
      );
    }
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: 8,
        }}
      >
        {pictured.map((image, index) => (
          <img
            key={image.media.mediaId + index}
            src={image.media.url}
            alt={image.alt}
            style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover' }}
          />
        ))}
      </div>
    );
  },
};
