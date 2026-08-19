import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import { tabConfig, tabPropsSchema } from './tab.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

function SlotContent() {
  return <span>Contenuto annidato</span>;
}

describe('tabPropsSchema', () => {
  it('accepts a valid label', () => {
    const result = tabPropsSchema.safeParse({ label: 'Descrizione' });
    expect(result.success).toBe(true);
  });

  it('rejects props without a label', () => {
    const result = tabPropsSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('tabConfig.render', () => {
  it('shows its own label so the tab is recognizable in the editor', () => {
    render(
      tabConfig.render({
        id: 'test-id',
        label: 'Descrizione',
        children: SlotContent,
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Tab: Descrizione')).toBeTruthy();
  });

  it('renders its slot content so the placed blocks are visible and editable', () => {
    render(
      tabConfig.render({
        id: 'test-id',
        label: 'Descrizione',
        children: SlotContent,
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Contenuto annidato')).toBeTruthy();
  });
});
