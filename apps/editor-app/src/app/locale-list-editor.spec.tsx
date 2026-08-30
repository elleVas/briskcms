import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '../components/ui/tooltip';
import { LocaleListEditor } from './locale-list-editor';

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

function openPicker() {
  fireEvent.click(screen.getByRole('button', { name: /aggiungi lingua/i }));
}

describe('LocaleListEditor', () => {
  it('shows the enabled locales with the default one badged', () => {
    renderEditor(['it-it', 'en-us'], 'it-it');

    expect(screen.getByText('it-it')).toBeTruthy();
    expect(screen.getByText('en-us')).toBeTruthy();
    expect(screen.getByText('Predefinita')).toBeTruthy();
  });

  it('adds a locale picked from the curated list, lowercased', () => {
    const onChange = vi.fn();
    renderEditor(['it-it'], 'it-it', onChange);
    openPicker();

    fireEvent.change(screen.getByPlaceholderText('Cerca una lingua...'), {
      target: { value: 'EN-US' },
    });
    fireEvent.click(screen.getByRole('button', { name: /en-us/i }));

    expect(onChange).toHaveBeenCalledWith(['it-it', 'en-us'], 'it-it');
  });

  it('filters by display name too, not just the code', () => {
    // The test i18n instance's active language is Italian, so display
    // names come back in Italian (getLocaleDisplayName(code, 'it')).
    renderEditor(['it-it'], 'it-it');
    openPicker();

    fireEvent.change(screen.getByPlaceholderText('Cerca una lingua...'), {
      target: { value: 'francese' },
    });

    expect(screen.getByRole('button', { name: /fr-fr/i })).toBeTruthy();
  });

  it('excludes already-enabled locales from the picker results', () => {
    renderEditor(['it-it'], 'it-it');
    openPicker();

    fireEvent.change(screen.getByPlaceholderText('Cerca una lingua...'), {
      target: { value: 'it-it' },
    });

    expect(screen.getByText('Nessuna lingua trovata')).toBeTruthy();
  });

  it('sets a non-default locale as the new default', () => {
    const onChange = vi.fn();
    renderEditor(['it-it', 'en-us'], 'it-it', onChange);

    fireEvent.click(
      screen.getByRole('button', { name: /imposta come predefinita/i }),
    );

    expect(onChange).toHaveBeenCalledWith(['it-it', 'en-us'], 'en-us');
  });

  it('removing the default locale promotes the next one', () => {
    const onChange = vi.fn();
    renderEditor(['it-it', 'en-us'], 'it-it', onChange);

    fireEvent.click(
      screen.getAllByRole('button', { name: /rimuovi lingua/i })[0],
    );

    expect(onChange).toHaveBeenCalledWith(['en-us'], 'en-us');
  });

  it('cannot remove the last remaining locale', () => {
    renderEditor(['it-it'], 'it-it');

    const removeButton = screen.getByRole('button', {
      name: /rimuovi lingua/i,
    }) as HTMLButtonElement;
    expect(removeButton.disabled).toBe(true);
  });
});
