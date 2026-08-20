import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import { containerConfig, containerPropsSchema } from './container.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

function SlotContent() {
  return <span>Contenuto annidato</span>;
}

describe('containerPropsSchema', () => {
  it('defaults background to none and padding to md when omitted', () => {
    const result = containerPropsSchema.parse({});
    expect(result.background).toBe('none');
    expect(result.padding).toBe('md');
  });

  it('accepts every background/padding option', () => {
    for (const background of ['none', 'muted', 'primary', 'secondary']) {
      expect(containerPropsSchema.safeParse({ background }).success).toBe(true);
    }
    for (const padding of ['none', 'sm', 'md', 'lg']) {
      expect(containerPropsSchema.safeParse({ padding }).success).toBe(true);
    }
  });

  it('rejects an unknown background', () => {
    const result = containerPropsSchema.safeParse({ background: 'rainbow' });
    expect(result.success).toBe(false);
  });
});

describe('containerConfig.render', () => {
  it('renders its slot content', () => {
    render(
      containerConfig.render({
        id: 'test-id',
        background: 'none',
        padding: 'md',
        children: SlotContent,
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Contenuto annidato')).toBeTruthy();
  });

  it('does not restrict which block types the slot accepts', () => {
    expect(containerConfig.fields?.children).toEqual({ type: 'slot' });
  });

  it('shows an editor-only label so the container reads as a distinct wrapper', () => {
    const slotSpy = vi.fn(() => null);
    render(
      containerConfig.render({
        id: 'test-id',
        background: 'none',
        padding: 'md',
        children: slotSpy,
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Contenitore')).toBeTruthy();
  });
});
