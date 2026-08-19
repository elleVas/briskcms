import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TableDataField } from './table-data-field.js';

describe('TableDataField', () => {
  it('shows every cell as an always-visible input, no collapse step', () => {
    render(
      <TableDataField
        value={[
          ['Nome', 'Ruolo'],
          ['Mario', 'CEO'],
        ]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue('Nome')).toBeTruthy();
    expect(screen.getByDisplayValue('Ruolo')).toBeTruthy();
    expect(screen.getByDisplayValue('Mario')).toBeTruthy();
    expect(screen.getByDisplayValue('CEO')).toBeTruthy();
  });

  it('updates a single cell without touching the others', () => {
    const onChange = vi.fn();
    render(
      <TableDataField
        value={[
          ['Nome', 'Ruolo'],
          ['Mario', 'CEO'],
        ]}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByDisplayValue('Mario'), {
      target: { value: 'Anna' },
    });

    expect(onChange).toHaveBeenCalledWith([
      ['Nome', 'Ruolo'],
      ['Anna', 'CEO'],
    ]);
  });

  it('adds a row matching the current column count', () => {
    const onChange = vi.fn();
    render(<TableDataField value={[['Nome', 'Ruolo']]} onChange={onChange} />);

    fireEvent.click(screen.getByText('Aggiungi riga'));

    expect(onChange).toHaveBeenCalledWith([
      ['Nome', 'Ruolo'],
      ['', ''],
    ]);
  });

  it('removes a row', () => {
    const onChange = vi.fn();
    render(
      <TableDataField
        value={[
          ['Nome', 'Ruolo'],
          ['Mario', 'CEO'],
          ['Anna', 'CTO'],
        ]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getAllByText('Rimuovi riga')[1]);

    expect(onChange).toHaveBeenCalledWith([
      ['Nome', 'Ruolo'],
      ['Anna', 'CTO'],
    ]);
  });

  it('adds a column to every row', () => {
    const onChange = vi.fn();
    render(
      <TableDataField value={[['Nome'], ['Mario']]} onChange={onChange} />,
    );

    fireEvent.click(screen.getByText('Aggiungi colonna'));

    expect(onChange).toHaveBeenCalledWith([
      ['Nome', ''],
      ['Mario', ''],
    ]);
  });

  it('removes the last column from every row', () => {
    const onChange = vi.fn();
    render(
      <TableDataField
        value={[
          ['Nome', 'Ruolo'],
          ['Mario', 'CEO'],
        ]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText('Rimuovi ultima colonna'));

    expect(onChange).toHaveBeenCalledWith([['Nome'], ['Mario']]);
  });

  it('disables removing the last remaining row', () => {
    render(<TableDataField value={[['Nome']]} onChange={vi.fn()} />);

    expect(screen.getByText('Rimuovi riga').hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('disables removing the last remaining column', () => {
    render(<TableDataField value={[['Nome']]} onChange={vi.fn()} />);

    expect(
      screen.getByText('Rimuovi ultima colonna').hasAttribute('disabled'),
    ).toBe(true);
  });
});
