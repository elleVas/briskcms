import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import { teamConfig, teamPropsSchema } from './team.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

function SlotContent() {
  return <span>Contenuto annidato</span>;
}

describe('teamPropsSchema', () => {
  it('accepts an empty object (no props of its own)', () => {
    const result = teamPropsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects unknown extra props (strict object)', () => {
    const result = teamPropsSchema.safeParse({ extra: 'x' });
    expect(result.success).toBe(false);
  });
});

describe('teamConfig.render', () => {
  it('renders its slot content so the placed TeamMember blocks are visible and editable', () => {
    render(
      teamConfig.render({
        id: 'test-id',
        children: SlotContent,
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Contenuto annidato')).toBeTruthy();
  });
});
