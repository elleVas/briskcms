import type { ComponentConfig } from '@puckeditor/core';
import {
  imageSliderPropsSchema,
  type ImageSliderProps,
  type PickedMedia,
} from '@brisk/shared-types';
import { GalleryPickerField } from '../fields/gallery-picker-field.js';

export { imageSliderPropsSchema, type ImageSliderProps };

type SliderImage = ImageSliderProps['images'][number];

function isPictured(
  image: SliderImage,
): image is SliderImage & { media: PickedMedia } {
  return image.media !== null;
}

export const imageSliderConfig: ComponentConfig<ImageSliderProps> = {
  label: 'Slider immagini',
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
  // Canvas preview is a static row, not the real swipeable/scroll-snap
  // carousel — that behavior only exists on apps/public-site
  // (ImageSlider.astro), same split as Gallery's own canvas grid.
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
          Nessuna immagine nello slider
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
        {pictured.map((image, index) => (
          <img
            key={image.media.mediaId + index}
            src={image.media.url}
            alt={image.alt}
            style={{
              width: 160,
              flexShrink: 0,
              aspectRatio: '16 / 9',
              objectFit: 'cover',
              borderRadius: 4,
            }}
          />
        ))}
      </div>
    );
  },
};
