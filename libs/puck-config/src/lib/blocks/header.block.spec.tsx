import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import { headerConfig, headerPropsSchema } from './header.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

function SlotContent() {
  return <span>Contenuto annidato</span>;
}

describe('headerPropsSchema', () => {
  it('accepts an empty object — Header has no props of its own', () => {
    expect(headerPropsSchema.safeParse({}).success).toBe(true);
  });
});

describe('headerConfig.render', () => {
  it('wraps its slot content in a <header> element', () => {
    render(
      headerConfig.render({
        id: 'test-id',
        children: SlotContent,
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Contenuto annidato')).toBeTruthy();
    expect(
      screen.getByText('Contenuto annidato').closest('header'),
    ).toBeTruthy();
  });
});
