import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '../components/ui/tooltip.js';
import { LocaleListEditor } from './locale-list-editor.js';

function renderEditor(
  enabledLocales: string[],
  defaultLocale: string,
  onChange: (enabledLocales: string[], defaultLocale: string) => void = vi.fn(),
) {
  return render(
    <TooltipProvider>
      <LocaleListEditor
        enabledLocales={enabledLocales}
        defaultLocale={defaultLocale}
        onChange={onChange}
      />
    </TooltipProvider>,
  );
}

describe('LocaleListEditor', () => {
  it('shows the enabled locales with the default one badged', () => {
    renderEditor(['it', 'en'], 'it');

    expect(screen.getByText('it')).toBeTruthy();
    expect(screen.getByText('en')).toBeTruthy();
    expect(screen.getByText('Predefinita')).toBeTruthy();
  });

  it('adds a new locale, lowercased', () => {
    const onChange = vi.fn();
    renderEditor(['it'], 'it', onChange);

    fireEvent.change(screen.getByPlaceholderText('es. en'), {
      target: { value: 'EN' },
    });
    fireEvent.click(screen.getByRole('button', { name: /aggiungi/i }));

    expect(onChange).toHaveBeenCalledWith(['it', 'en'], 'it');
  });

  it('does not add a duplicate locale', () => {
    const onChange = vi.fn();
    renderEditor(['it'], 'it', onChange);

    fireEvent.change(screen.getByPlaceholderText('es. en'), {
      target: { value: 'it' },
    });
    fireEvent.click(screen.getByRole('button', { name: /aggiungi/i }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('sets a non-default locale as the new default', () => {
    const onChange = vi.fn();
    renderEditor(['it', 'en'], 'it', onChange);

    fireEvent.click(
      screen.getByRole('button', { name: /imposta come predefinita/i }),
    );

    expect(onChange).toHaveBeenCalledWith(['it', 'en'], 'en');
  });

  it('removing the default locale promotes the next one', () => {
    const onChange = vi.fn();
    renderEditor(['it', 'en'], 'it', onChange);

    fireEvent.click(
      screen.getAllByRole('button', { name: /rimuovi lingua/i })[0],
    );

    expect(onChange).toHaveBeenCalledWith(['en'], 'en');
  });

  it('cannot remove the last remaining locale', () => {
    renderEditor(['it'], 'it');

    const removeButton = screen.getByRole('button', {
      name: /rimuovi lingua/i,
    }) as HTMLButtonElement;
    expect(removeButton.disabled).toBe(true);
  });
});
