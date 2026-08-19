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
  it('defaults position to left and visibility to mobile-only when omitted', () => {
    const result = hamburgerMenuPropsSchema.parse({});
    expect(result.position).toBe('left');
    expect(result.visibility).toBe('mobile-only');
  });
});

describe('hamburgerMenuConfig.render', () => {
  it('is always visible in the editor canvas, not hidden behind a breakpoint', () => {
    render(
      hamburgerMenuConfig.render({
        id: 'test-id',
        position: 'left',
        visibility: 'mobile-only',
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
        position: 'left',
        visibility: 'mobile-only',
        children: SlotContent,
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Contenuto annidato')).toBeTruthy();
  });
});
