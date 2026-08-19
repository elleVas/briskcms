import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import { columnsConfig, columnsPropsSchema } from './columns.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

function SlotContent() {
  return <span>Contenuto annidato</span>;
}

describe('columnsPropsSchema', () => {
  it('defaults layout to two-equal when omitted', () => {
    const result = columnsPropsSchema.parse({});
    expect(result.layout).toBe('two-equal');
  });

  it('accepts an explicit layout', () => {
    const result = columnsPropsSchema.safeParse({ layout: 'three-equal' });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown layout', () => {
    const result = columnsPropsSchema.safeParse({ layout: 'four-equal' });
    expect(result.success).toBe(false);
  });
});

describe('columnsConfig.render', () => {
  it('renders its slot content', () => {
    render(
      columnsConfig.render({
        id: 'test-id',
        layout: 'two-equal',
        children: SlotContent,
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Contenuto annidato')).toBeTruthy();
  });

  it('shows an editor-only label so the columns row reads as a distinct container', () => {
    render(
      columnsConfig.render({
        id: 'test-id',
        layout: 'two-equal',
        children: SlotContent,
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Colonne')).toBeTruthy();
  });

  it.each([
    ['two-equal', '1fr 1fr'],
    ['two-asymmetric', '3fr 7fr'],
    ['three-equal', '1fr 1fr 1fr'],
  ] as const)(
    'renders the slot as a CSS grid matching the %s layout',
    (layout, expectedTemplate) => {
      const slotSpy = vi.fn<(props?: { style?: unknown }) => null>(() => null);

      render(
        columnsConfig.render({
          id: 'test-id',
          layout,
          children: slotSpy,
          puck: puckContext,
        }),
      );

      expect(slotSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          style: expect.objectContaining({
            display: 'grid',
            gridTemplateColumns: expectedTemplate,
          }),
        }),
      );
    },
  );
});
