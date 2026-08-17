import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import { heroConfig, heroPropsSchema } from './hero.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('heroPropsSchema', () => {
  it('accepts valid Hero props', () => {
    const result = heroPropsSchema.safeParse({
      title: 'Ciao',
      subtitle: 'Sottotitolo',
    });
    expect(result.success).toBe(true);
  });

  it('rejects Hero props missing a subtitle', () => {
    const result = heroPropsSchema.safeParse({ title: 'Ciao' });
    expect(result.success).toBe(false);
  });
});

describe('heroConfig.render', () => {
  it('renders the title and subtitle', () => {
    render(
      heroConfig.render({
        id: 'test-id',
        title: 'Ciao',
        subtitle: 'Sottotitolo',
        puck: puckContext,
      }),
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Ciao' }),
    ).toBeTruthy();
    expect(screen.getByText('Sottotitolo')).toBeTruthy();
  });
});
