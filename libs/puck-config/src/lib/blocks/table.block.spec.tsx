import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import { tableConfig, tablePropsSchema } from './table.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('tablePropsSchema', () => {
  it('accepts a matrix of rows', () => {
    const result = tablePropsSchema.safeParse({
      rows: [
        ['Nome', 'Ruolo'],
        ['Mario', 'CEO'],
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects props without rows', () => {
    const result = tablePropsSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('tableConfig.render', () => {
  it('renders the first row as the header and the rest as body rows', () => {
    render(
      tableConfig.render({
        id: 'test-id',
        rows: [
          ['Nome', 'Ruolo'],
          ['Mario', 'CEO'],
        ],
        puck: puckContext,
      }),
    );

    expect(screen.getByRole('columnheader', { name: 'Nome' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'Mario' })).toBeTruthy();
  });

  it('renders just the header when there are no body rows', () => {
    render(
      tableConfig.render({
        id: 'test-id',
        rows: [['Nome', 'Ruolo']],
        puck: puckContext,
      }),
    );

    expect(screen.getByRole('columnheader', { name: 'Nome' })).toBeTruthy();
    expect(screen.queryByRole('cell')).toBeFalsy();
  });
});
