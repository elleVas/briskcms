import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import {
  navDropdownConfig,
  navDropdownPropsSchema,
} from './nav-dropdown.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

function SlotContent() {
  return <span>Contenuto annidato</span>;
}

describe('navDropdownPropsSchema', () => {
  it('defaults position to left and visibility to always when omitted', () => {
    const result = navDropdownPropsSchema.parse({ label: 'Prodotti' });
    expect(result.position).toBe('left');
    expect(result.visibility).toBe('always');
  });
});

describe('navDropdownConfig.render', () => {
  it('shows its own label so the trigger is recognizable in the editor', () => {
    render(
      navDropdownConfig.render({
        id: 'test-id',
        label: 'Prodotti',
        position: 'left',
        visibility: 'always',
        children: SlotContent,
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Prodotti ▾')).toBeTruthy();
  });

  it('renders its slot content so the placed NavLink items are visible and editable', () => {
    render(
      navDropdownConfig.render({
        id: 'test-id',
        label: 'Prodotti',
        position: 'left',
        visibility: 'always',
        children: SlotContent,
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Contenuto annidato')).toBeTruthy();
  });
});
