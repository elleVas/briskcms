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
  it('accepts an empty object — no editor-time config', () => {
    expect(languageSwitcherPropsSchema.safeParse({}).success).toBe(true);
  });
});

describe('languageSwitcherConfig.render', () => {
  it('renders a canvas-only placeholder, never real links', () => {
    render(languageSwitcherConfig.render({ id: 'test-id', puck: puckContext }));

    expect(screen.getByText('IT · EN (selettore lingua)')).toBeTruthy();
  });
});
