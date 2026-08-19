import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import { ratingConfig, ratingPropsSchema } from './rating.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('ratingPropsSchema', () => {
  it('accepts a rating within 1-5', () => {
    const result = ratingPropsSchema.safeParse({ rating: 3, label: '' });
    expect(result.success).toBe(true);
  });

  it('rejects a rating below 1', () => {
    const result = ratingPropsSchema.safeParse({ rating: 0, label: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a rating above 5', () => {
    const result = ratingPropsSchema.safeParse({ rating: 6, label: '' });
    expect(result.success).toBe(false);
  });
});

describe('ratingConfig.render', () => {
  it('renders 5 stars, filling only up to the given rating', () => {
    const { container } = render(
      ratingConfig.render({
        id: 'test-id',
        rating: 3,
        label: '',
        puck: puckContext,
      }),
    );

    const paths = container.querySelectorAll('svg path');
    expect(paths).toHaveLength(5);
    const fills = Array.from(paths).map((path) => path.getAttribute('fill'));
    expect(fills).toEqual([
      '#f59e0b',
      '#f59e0b',
      '#f59e0b',
      '#d4d4d8',
      '#d4d4d8',
    ]);
  });
});
