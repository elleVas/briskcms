import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import { logoStripConfig, logoStripPropsSchema } from './logo-strip.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('logoStripPropsSchema', () => {
  it('accepts an empty strip', () => {
    const result = logoStripPropsSchema.safeParse({ logos: [] });
    expect(result.success).toBe(true);
  });

  it('accepts a strip with picked and not-yet-picked slots', () => {
    const result = logoStripPropsSchema.safeParse({
      logos: [
        { media: { mediaId: 'media-1', url: 'http://a' }, alt: 'Acme' },
        { media: null, alt: '' },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('logoStripConfig.render', () => {
  it('renders a logo for every populated slot, skipping empty ones', () => {
    render(
      logoStripConfig.render({
        id: 'test-id',
        logos: [
          {
            media: { mediaId: 'media-1', url: 'http://localhost/a.webp' },
            alt: 'Acme',
          },
          { media: null, alt: '' },
          {
            media: { mediaId: 'media-2', url: 'http://localhost/b.webp' },
            alt: 'Globex',
          },
        ],
        puck: puckContext,
      }),
    );

    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'Acme' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Globex' })).toBeTruthy();
  });

  it('renders a visible placeholder when no slot has a logo yet', () => {
    render(
      logoStripConfig.render({
        id: 'test-id',
        logos: [{ media: null, alt: '' }],
        puck: puckContext,
      }),
    );

    expect(screen.queryByRole('img')).toBeFalsy();
    expect(screen.getByText('Nessun logo aggiunto')).toBeTruthy();
  });
});
