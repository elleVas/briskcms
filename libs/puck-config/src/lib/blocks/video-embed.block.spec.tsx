import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import {
  videoEmbedConfig,
  videoEmbedPropsSchema,
} from './video-embed.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('videoEmbedPropsSchema', () => {
  it('accepts a video URL', () => {
    const result = videoEmbedPropsSchema.safeParse({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
    expect(result.success).toBe(true);
  });

  it('rejects props without a url', () => {
    const result = videoEmbedPropsSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('videoEmbedConfig.render', () => {
  it('shows the configured url as a static preview', () => {
    render(
      videoEmbedConfig.render({
        id: 'test-id',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        puck: puckContext,
      }),
    );

    expect(
      screen.getByText('Video: https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    ).toBeTruthy();
  });

  it('shows a placeholder when no url is set', () => {
    render(
      videoEmbedConfig.render({ id: 'test-id', url: '', puck: puckContext }),
    );

    expect(screen.getByText('Nessun video impostato')).toBeTruthy();
  });
});

describe('videoEmbedConfig.fields', () => {
  it('keeps url in the sidebar (not rendered as visible page content)', () => {
    expect(videoEmbedConfig.fields?.url).not.toHaveProperty(
      'contentEditable',
      true,
    );
  });
});
