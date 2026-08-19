import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import { accordionConfig, accordionPropsSchema } from './accordion.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

function SlotContent() {
  return <span>Contenuto annidato</span>;
}

describe('accordionPropsSchema', () => {
  it('accepts an empty object (no props of its own)', () => {
    const result = accordionPropsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects unknown extra props (strict object)', () => {
    const result = accordionPropsSchema.safeParse({ extra: 'x' });
    expect(result.success).toBe(false);
  });
});

describe('accordionConfig.render', () => {
  it('renders its slot content so the placed AccordionItem blocks are visible and editable', () => {
    render(
      accordionConfig.render({
        id: 'test-id',
        children: SlotContent,
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Contenuto annidato')).toBeTruthy();
  });
});
