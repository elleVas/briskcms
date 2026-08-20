import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import { mapEmbedConfig, mapEmbedPropsSchema } from './map-embed.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('mapEmbedPropsSchema', () => {
  it('accepts an address', () => {
    const result = mapEmbedPropsSchema.safeParse({
      address: 'Via Roma 1, Milano',
    });
    expect(result.success).toBe(true);
  });

  it('rejects props without an address', () => {
    const result = mapEmbedPropsSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('mapEmbedConfig.render', () => {
  it('shows the configured address as a static preview', () => {
    render(
      mapEmbedConfig.render({
        id: 'test-id',
        address: 'Via Roma 1, Milano',
        puck: puckContext,
      }),
    );

    expect(screen.getByText(/Via Roma 1, Milano/)).toBeTruthy();
  });

  it('shows a placeholder when no address is set', () => {
    render(
      mapEmbedConfig.render({ id: 'test-id', address: '', puck: puckContext }),
    );

    expect(screen.getByText(/Nessun indirizzo impostato/)).toBeTruthy();
  });
});

describe('mapEmbedConfig.fields', () => {
  it('edits address inline on the canvas instead of the sidebar', () => {
    expect(mapEmbedConfig.fields?.address).toMatchObject({
      type: 'text',
      contentEditable: true,
      visible: false,
    });
  });
});
