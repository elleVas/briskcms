import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import {
  beforeAfterConfig,
  beforeAfterPropsSchema,
} from './before-after.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('beforeAfterPropsSchema', () => {
  it('defaults beforeLabel/afterLabel when omitted', () => {
    const result = beforeAfterPropsSchema.parse({
      beforeImage: null,
      afterImage: null,
    });
    expect(result.beforeLabel).toBe('Prima');
    expect(result.afterLabel).toBe('Dopo');
  });

  it('accepts both images set', () => {
    const result = beforeAfterPropsSchema.safeParse({
      beforeImage: { mediaId: 'media-1', url: 'http://a' },
      afterImage: { mediaId: 'media-2', url: 'http://b' },
      beforeLabel: 'Prima',
      afterLabel: 'Dopo',
    });
    expect(result.success).toBe(true);
  });
});

describe('beforeAfterConfig.render', () => {
  it('renders both images with their labels when both are picked', () => {
    render(
      beforeAfterConfig.render({
        id: 'test-id',
        beforeImage: { mediaId: 'media-1', url: 'http://localhost/a.webp' },
        afterImage: { mediaId: 'media-2', url: 'http://localhost/b.webp' },
        beforeLabel: 'Prima',
        afterLabel: 'Dopo',
        puck: puckContext,
      }),
    );

    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'Prima' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Dopo' })).toBeTruthy();
  });

  it('renders a placeholder when either image is missing', () => {
    render(
      beforeAfterConfig.render({
        id: 'test-id',
        beforeImage: { mediaId: 'media-1', url: 'http://localhost/a.webp' },
        afterImage: null,
        beforeLabel: 'Prima',
        afterLabel: 'Dopo',
        puck: puckContext,
      }),
    );

    expect(screen.queryByRole('img')).toBeFalsy();
    expect(
      screen.getByText(
        'Seleziona entrambe le immagini per il confronto prima/dopo',
      ),
    ).toBeTruthy();
  });
});

describe('beforeAfterConfig.fields', () => {
  it('edits beforeLabel/afterLabel inline on the canvas instead of the sidebar', () => {
    expect(beforeAfterConfig.fields?.beforeLabel).toMatchObject({
      type: 'text',
      contentEditable: true,
      visible: false,
    });
    expect(beforeAfterConfig.fields?.afterLabel).toMatchObject({
      type: 'text',
      contentEditable: true,
      visible: false,
    });
  });
});
