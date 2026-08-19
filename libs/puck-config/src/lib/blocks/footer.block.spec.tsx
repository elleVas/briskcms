import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import { footerConfig, footerPropsSchema } from './footer.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

function SlotContent() {
  return <span>Contenuto annidato</span>;
}

describe('footerPropsSchema', () => {
  it('accepts an empty object — Footer has no props of its own', () => {
    expect(footerPropsSchema.safeParse({}).success).toBe(true);
  });
});

describe('footerConfig.render', () => {
  it('wraps its slot content in a <footer> element', () => {
    render(
      footerConfig.render({
        id: 'test-id',
        children: SlotContent,
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Contenuto annidato')).toBeTruthy();
    expect(
      screen.getByText('Contenuto annidato').closest('footer'),
    ).toBeTruthy();
  });
});
