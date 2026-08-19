import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import { backToTopConfig, backToTopPropsSchema } from './back-to-top.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('backToTopPropsSchema', () => {
  it('defaults visibility to always when omitted', () => {
    const result = backToTopPropsSchema.parse({});
    expect(result.visibility).toBe('always');
  });

  it('accepts an explicit visibility', () => {
    const result = backToTopPropsSchema.safeParse({
      visibility: 'mobile-only',
    });
    expect(result.success).toBe(true);
  });
});

describe('backToTopConfig.render', () => {
  it('renders a button with an accessible label', () => {
    render(
      backToTopConfig.render({
        id: 'test-id',
        visibility: 'always',
        puck: puckContext,
      }),
    );

    expect(screen.getByLabelText('Torna su')).toBeTruthy();
  });
});
