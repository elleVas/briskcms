import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import {
  languageSwitcherConfig,
  languageSwitcherPropsSchema,
} from './language-switcher.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('languageSwitcherPropsSchema', () => {
  it('defaults position to left and visibility to always when omitted', () => {
    const result = languageSwitcherPropsSchema.parse({});
    expect(result.position).toBe('left');
    expect(result.visibility).toBe('always');
  });

  it('accepts an explicit position', () => {
    const result = languageSwitcherPropsSchema.safeParse({
      position: 'right',
    });
    expect(result.success).toBe(true);
  });
});

describe('languageSwitcherConfig.render', () => {
  it('renders a canvas-only placeholder, never real links', () => {
    render(
      languageSwitcherConfig.render({
        id: 'test-id',
        position: 'left',
        visibility: 'always',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('IT · EN (selettore lingua)')).toBeTruthy();
  });

  it('pushes itself to the far side of the flex row when positioned right', () => {
    render(
      languageSwitcherConfig.render({
        id: 'test-id',
        position: 'right',
        visibility: 'always',
        puck: puckContext,
      }),
    );

    expect(
      screen.getByText('IT · EN (selettore lingua)').style.marginLeft,
    ).toBe('auto');
  });
});
