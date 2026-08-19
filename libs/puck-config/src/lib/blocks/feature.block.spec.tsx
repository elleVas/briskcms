import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import { featureConfig, featurePropsSchema } from './feature.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('featurePropsSchema', () => {
  it('accepts valid Feature props', () => {
    const result = featurePropsSchema.safeParse({
      icon: '🚀',
      title: 'Veloce',
      text: 'Prestazioni ottime.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects props without a title', () => {
    const result = featurePropsSchema.safeParse({
      icon: '🚀',
      text: 'Prestazioni ottime.',
    });
    expect(result.success).toBe(false);
  });
});

describe('featureConfig.render', () => {
  it('renders the icon, title and text', () => {
    render(
      featureConfig.render({
        id: 'test-id',
        icon: '🚀',
        title: 'Veloce',
        text: 'Prestazioni ottime.',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('🚀')).toBeTruthy();
    expect(screen.getByText('Veloce')).toBeTruthy();
    expect(screen.getByText('Prestazioni ottime.')).toBeTruthy();
  });
});
