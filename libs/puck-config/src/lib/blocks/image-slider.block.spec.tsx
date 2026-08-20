import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import {
  imageSliderConfig,
  imageSliderPropsSchema,
} from './image-slider.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('imageSliderPropsSchema', () => {
  it('accepts an empty slider', () => {
    const result = imageSliderPropsSchema.safeParse({ images: [] });
    expect(result.success).toBe(true);
  });

  it('accepts a slider with picked and not-yet-picked slots', () => {
    const result = imageSliderPropsSchema.safeParse({
      images: [
        { media: { mediaId: 'media-1', url: 'http://a' }, alt: 'Una foto' },
        { media: null, alt: '' },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('imageSliderConfig.render', () => {
  it('renders an image for every populated slot, skipping empty ones', () => {
    render(
      imageSliderConfig.render({
        id: 'test-id',
        images: [
          {
            media: { mediaId: 'media-1', url: 'http://localhost/a.webp' },
            alt: 'Prima foto',
          },
          { media: null, alt: '' },
          {
            media: { mediaId: 'media-2', url: 'http://localhost/b.webp' },
            alt: 'Seconda foto',
          },
        ],
        puck: puckContext,
      }),
    );

    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'Prima foto' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Seconda foto' })).toBeTruthy();
  });

  it('renders a visible placeholder when no slot has an image yet', () => {
    render(
      imageSliderConfig.render({
        id: 'test-id',
        images: [{ media: null, alt: '' }],
        puck: puckContext,
      }),
    );

    expect(screen.queryByRole('img')).toBeFalsy();
    expect(screen.getByText('Nessuna immagine nello slider')).toBeTruthy();
  });
});
