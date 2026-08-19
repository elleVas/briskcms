import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import {
  hamburgerMenuConfig,
  hamburgerMenuPropsSchema,
} from './hamburger-menu.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

function SlotContent() {
  return <span>Contenuto annidato</span>;
}

describe('hamburgerMenuPropsSchema', () => {
  it('accepts an empty object — HamburgerMenu has no props of its own', () => {
    expect(hamburgerMenuPropsSchema.safeParse({}).success).toBe(true);
  });
});

describe('hamburgerMenuConfig.render', () => {
  it('is always visible in the editor canvas, not hidden behind a breakpoint', () => {
    render(
      hamburgerMenuConfig.render({
        id: 'test-id',
        children: SlotContent,
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Menu mobile (hamburger)')).toBeTruthy();
  });

  it('renders its slot content so the placed NavLink/LanguageSwitcher items are visible and editable', () => {
    render(
      hamburgerMenuConfig.render({
        id: 'test-id',
        children: SlotContent,
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Contenuto annidato')).toBeTruthy();
  });
});
