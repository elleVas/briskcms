import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import {
  testimonialsConfig,
  testimonialsPropsSchema,
} from './testimonials.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

function SlotContent() {
  return <span>Contenuto annidato</span>;
}

describe('testimonialsPropsSchema', () => {
  it('accepts an empty object (no props of its own)', () => {
    const result = testimonialsPropsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects unknown extra props (strict object)', () => {
    const result = testimonialsPropsSchema.safeParse({ extra: 'x' });
    expect(result.success).toBe(false);
  });
});

describe('testimonialsConfig.render', () => {
  it('renders its slot content so the placed Testimonial blocks are visible and editable', () => {
    render(
      testimonialsConfig.render({
        id: 'test-id',
        children: SlotContent,
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Contenuto annidato')).toBeTruthy();
  });
});
