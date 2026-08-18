import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import { imageConfig, imagePropsSchema } from './image.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

const media = { mediaId: 'media-1', url: 'http://localhost/uploads/a.webp' };

describe('imagePropsSchema', () => {
  it('accepts valid Image props with a media selected', () => {
    const result = imagePropsSchema.safeParse({
      media,
      alt: 'Descrizione',
      caption: '',
    });
    expect(result.success).toBe(true);
  });

  it('accepts Image props with no media selected yet', () => {
    const result = imagePropsSchema.safeParse({
      media: null,
      alt: '',
      caption: '',
    });
    expect(result.success).toBe(true);
  });

  it('rejects Image props missing alt', () => {
    const result = imagePropsSchema.safeParse({ media: null, caption: '' });
    expect(result.success).toBe(false);
  });
});

describe('imageConfig.render', () => {
  it('renders the image and caption when a media is selected', () => {
    render(
      imageConfig.render({
        id: 'test-id',
        media,
        alt: 'Descrizione',
        caption: 'Una didascalia',
        puck: puckContext,
      }),
    );

    expect(screen.getByRole('img', { name: 'Descrizione' })).toHaveProperty(
      'src',
      media.url,
    );
    expect(screen.getByText('Una didascalia')).toBeTruthy();
  });

  it('renders a placeholder when no media is selected', () => {
    render(
      imageConfig.render({
        id: 'test-id',
        media: null,
        alt: '',
        caption: '',
        puck: puckContext,
      }),
    );

    expect(screen.queryByRole('img')).toBeFalsy();
    expect(screen.getByText('Nessuna immagine selezionata')).toBeTruthy();
  });
});
