import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import { searchBoxConfig, searchBoxPropsSchema } from './search-box.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('searchBoxPropsSchema', () => {
  it('defaults placeholder and visibility when omitted', () => {
    const result = searchBoxPropsSchema.parse({});
    expect(result.placeholder).toBe('Cerca nel sito...');
    expect(result.visibility).toBe('always');
  });

  it('accepts an explicit placeholder and visibility', () => {
    const result = searchBoxPropsSchema.safeParse({
      placeholder: 'Cosa cerchi?',
      visibility: 'desktop-only',
    });
    expect(result.success).toBe(true);
  });
});

describe('searchBoxConfig.render', () => {
  it('renders the configured placeholder', () => {
    render(
      searchBoxConfig.render({
        id: 'test-id',
        placeholder: 'Cosa cerchi?',
        visibility: 'always',
        puck: puckContext,
      }),
    );

    expect(screen.getByPlaceholderText('Cosa cerchi?')).toBeTruthy();
  });
});
