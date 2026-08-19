import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import {
  featureGridConfig,
  featureGridPropsSchema,
} from './feature-grid.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

function SlotContent() {
  return <span>Contenuto annidato</span>;
}

describe('featureGridPropsSchema', () => {
  it('accepts an empty object (no props of its own)', () => {
    const result = featureGridPropsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects unknown extra props (strict object)', () => {
    const result = featureGridPropsSchema.safeParse({ extra: 'x' });
    expect(result.success).toBe(false);
  });
});

describe('featureGridConfig.render', () => {
  it('renders its slot content so the placed Feature blocks are visible and editable', () => {
    render(
      featureGridConfig.render({
        id: 'test-id',
        children: SlotContent,
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Contenuto annidato')).toBeTruthy();
  });
});
