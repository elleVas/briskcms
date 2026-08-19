import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import { navConfig, navPropsSchema } from './nav.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

function SlotContent() {
  return <span>Contenuto annidato</span>;
}

describe('navPropsSchema', () => {
  it('accepts an empty object — Nav has no props of its own', () => {
    expect(navPropsSchema.safeParse({}).success).toBe(true);
  });
});

describe('navConfig.render', () => {
  it('wraps its slot content in a <nav> element', () => {
    render(
      navConfig.render({
        id: 'test-id',
        children: SlotContent,
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Contenuto annidato')).toBeTruthy();
    expect(screen.getByText('Contenuto annidato').closest('nav')).toBeTruthy();
  });
});
