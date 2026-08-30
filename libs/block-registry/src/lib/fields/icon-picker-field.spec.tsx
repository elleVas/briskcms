import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { IconListContext, type IconListPort } from '../icon-list-context';
import { IconPickerField } from './icon-picker-field';

function wrapperWith(port: IconListPort) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <IconListContext.Provider value={port}>
        {children}
      </IconListContext.Provider>
    );
  };
}

describe('IconPickerField', () => {
  it('shows "Scegli icona" and no preview when value is null', () => {
    render(<IconPickerField value={null} onChange={vi.fn()} />, {
      wrapper: wrapperWith({ pick: vi.fn(), resolve: vi.fn() }),
    });

    expect(screen.getByText('Scegli icona')).toBeTruthy();
  });

  it('resolves and shows the SVG preview and "Cambia icona" when a value is set', () => {
    const resolve = vi.fn().mockReturnValue('<svg data-testid="icon-svg" />');
    render(<IconPickerField value="arrow-right" onChange={vi.fn()} />, {
      wrapper: wrapperWith({ pick: vi.fn(), resolve }),
    });

    expect(resolve).toHaveBeenCalledWith('arrow-right');
    expect(screen.getByText('Cambia icona')).toBeTruthy();
    expect(screen.getByTestId('icon-svg')).toBeTruthy();
  });

  it('calls onChange with the picked icon name when the port resolves one', async () => {
    const onChange = vi.fn();
    const pick = vi.fn().mockResolvedValue('arrow-right');
    render(<IconPickerField value={null} onChange={onChange} />, {
      wrapper: wrapperWith({ pick, resolve: vi.fn() }),
    });

    fireEvent.click(screen.getByText('Scegli icona'));
    await Promise.resolve();
    await Promise.resolve();

    expect(onChange).toHaveBeenCalledWith('arrow-right');
  });

  it('does not call onChange when the picker is dismissed without a selection', async () => {
    const onChange = vi.fn();
    const pick = vi.fn().mockResolvedValue(null);
    render(<IconPickerField value={null} onChange={onChange} />, {
      wrapper: wrapperWith({ pick, resolve: vi.fn() }),
    });

    fireEvent.click(screen.getByText('Scegli icona'));
    await Promise.resolve();
    await Promise.resolve();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('calls onChange with null when the remove button is clicked', () => {
    const onChange = vi.fn();
    render(<IconPickerField value="arrow-right" onChange={onChange} />, {
      wrapper: wrapperWith({ pick: vi.fn(), resolve: vi.fn() }),
    });

    fireEvent.click(screen.getByTitle('Rimuovi icona'));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
