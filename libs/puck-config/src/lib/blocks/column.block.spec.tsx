import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import { columnConfig, columnPropsSchema } from './column.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

function SlotContent() {
  return <span>Contenuto annidato</span>;
}

describe('columnPropsSchema', () => {
  it('accepts an empty object — Column has no props of its own', () => {
    expect(columnPropsSchema.safeParse({}).success).toBe(true);
  });
});

describe('columnConfig.render', () => {
  it('renders its slot content', () => {
    render(
      columnConfig.render({
        id: 'test-id',
        children: SlotContent,
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Contenuto annidato')).toBeTruthy();
  });

  it('shows an editor-only label so the column reads as a distinct container', () => {
    render(
      columnConfig.render({
        id: 'test-id',
        children: SlotContent,
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Colonna')).toBeTruthy();
  });
});
