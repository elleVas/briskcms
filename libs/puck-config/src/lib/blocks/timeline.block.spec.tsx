import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import { timelineConfig, timelinePropsSchema } from './timeline.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

function SlotContent() {
  return <span>Contenuto annidato</span>;
}

describe('timelinePropsSchema', () => {
  it('accepts an empty object (no props of its own)', () => {
    const result = timelinePropsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects unknown extra props (strict object)', () => {
    const result = timelinePropsSchema.safeParse({ extra: 'x' });
    expect(result.success).toBe(false);
  });
});

describe('timelineConfig.render', () => {
  it('renders its slot content so the placed TimelineStep blocks are visible and editable', () => {
    render(
      timelineConfig.render({
        id: 'test-id',
        children: SlotContent,
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Contenuto annidato')).toBeTruthy();
  });
});
