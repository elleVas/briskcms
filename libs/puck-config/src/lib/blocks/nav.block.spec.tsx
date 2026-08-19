import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import { navConfig, navPropsSchema } from './nav.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

function SlotContent() {
  return <span>Contenuto annidato</span>;
}

describe('navPropsSchema', () => {
  it('defaults visibility to always when omitted', () => {
    expect(navPropsSchema.parse({}).visibility).toBe('always');
  });
});

describe('navConfig.render', () => {
  it('wraps its slot content in a <nav> element', () => {
    render(
      navConfig.render({
        id: 'test-id',
        visibility: 'always',
        children: SlotContent,
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Contenuto annidato')).toBeTruthy();
    expect(screen.getByText('Contenuto annidato').closest('nav')).toBeTruthy();
  });

  it('shows an editor-only label so the nav reads as a distinct container', () => {
    render(
      navConfig.render({
        id: 'test-id',
        visibility: 'always',
        children: SlotContent,
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Menu di navigazione')).toBeTruthy();
  });

  it('renders the slot as a flex row so a right-positioned child can push itself across', () => {
    const slotSpy = vi.fn<(props?: { style?: unknown }) => null>(() => null);

    render(
      navConfig.render({
        id: 'test-id',
        visibility: 'always',
        children: slotSpy,
        puck: puckContext,
      }),
    );

    expect(slotSpy.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        style: expect.objectContaining({ display: 'flex' }),
      }),
    );
  });
});
