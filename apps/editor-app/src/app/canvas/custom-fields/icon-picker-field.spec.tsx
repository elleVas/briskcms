import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import * as themeApi from '../../../lib/theme-api-client';
import { createTestQueryClient } from '../../../test/query-client.test-fixture';
import { IconListContext, type IconListPort } from '../../icon-list-context';
import { IconPickerField } from './icon-picker-field';

vi.mock('../../use-active-theme-name', () => ({
  useActiveThemeName: () => 'classic',
}));

vi.mock('../../../lib/theme-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../lib/theme-api-client')>();
  return { ...actual, fetchThemeIcons: vi.fn() };
});

function wrapperWith(port: IconListPort) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={createTestQueryClient()}>
        <IconListContext.Provider value={port}>
          {children}
        </IconListContext.Provider>
      </QueryClientProvider>
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

  /*
   * The provider preloads the interface icons only, so a logo chosen
   * yesterday had no preview today. It is now fetched on its own — that
   * one logo, not the 5.2MB set it belongs to.
   */
  it('previews a logo by fetching that logo alone', async () => {
    vi.mocked(themeApi.fetchThemeIcons).mockResolvedValue([
      { name: 'brand:github', svg: '<svg data-testid="brand-svg" />' },
    ]);
    const resolve = vi.fn();
    render(<IconPickerField value="brand:github" onChange={vi.fn()} />, {
      wrapper: wrapperWith({ pick: vi.fn(), resolve }),
    });

    expect(await screen.findByTestId('brand-svg')).toBeTruthy();
    expect(themeApi.fetchThemeIcons).toHaveBeenCalledWith('classic', 'brand', {
      names: ['brand:github'],
    });
    expect(resolve).not.toHaveBeenCalled();
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

    // By accessible name, not by `title`: the button is labelled through
    // i18n now, and a screen reader finds it the same way this does.
    fireEvent.click(screen.getByRole('button', { name: 'Rimuovi icona' }));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
