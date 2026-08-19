import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import { tabsConfig, tabsPropsSchema } from './tabs.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

function SlotContent() {
  return <span>Contenuto annidato</span>;
}

describe('tabsPropsSchema', () => {
  it('accepts an empty object (no props of its own)', () => {
    const result = tabsPropsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects unknown extra props (strict object)', () => {
    const result = tabsPropsSchema.safeParse({ extra: 'x' });
    expect(result.success).toBe(false);
  });
});

describe('tabsConfig.render', () => {
  it('renders its slot content so the placed Tab blocks are visible and editable', () => {
    render(
      tabsConfig.render({
        id: 'test-id',
        children: SlotContent,
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Contenuto annidato')).toBeTruthy();
  });
});
