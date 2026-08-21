import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as api from '../lib/sites-api-client.js';
import type { SiteDto } from '../lib/sites-api-client.js';
import { createTestQueryClient } from '../test-query-client.js';
import { GlobalStylesDialog } from './global-styles-dialog.js';

vi.mock('../lib/sites-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/sites-api-client.js')>();
  return {
    ...actual,
    getSite: vi.fn(),
    updateThemeSettings: vi.fn(),
    updateThemeTokens: vi.fn(),
  };
});

function buildSite(overrides: Partial<SiteDto> = {}): SiteDto {
  return {
    id: 'site-1',
    tenantId: 'tenant-1',
    name: 'Il mio sito',
    domain: null,
    defaultLocale: 'it',
    enabledLocales: ['it'],
    untranslatedPageFallback: 'redirect-to-default',
    businessAddress: null,
    businessPhone: null,
    businessType: null,
    openingHours: null,
    searchEngineIndexingEnabled: false,
    themePrimaryColor: null,
    themeSecondaryColor: null,
    themeFontFamily: null,
    themeCustomCss: null,
    themeHeadScript: null,
    themeBodyScript: null,
    themeFaviconUrl: null,
    themeOverridesEnabled: true,
    themeTokens: null,
    createdAt: '',
    ...overrides,
  };
}

function renderDialog(open: boolean, onOpenChange = vi.fn()) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <GlobalStylesDialog
        siteId="site-1"
        open={open}
        onOpenChange={onOpenChange}
      />
    </QueryClientProvider>,
  );
}

describe('GlobalStylesDialog', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows a loading state until the site arrives', async () => {
    vi.mocked(api.getSite).mockResolvedValue(buildSite());
    renderDialog(true);

    expect(screen.getByText('Caricamento...')).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByText('Caricamento...')).toBeNull(),
    );
  });

  it('defaults to the Colori tab with both colors off when never customized', async () => {
    vi.mocked(api.getSite).mockResolvedValue(buildSite());
    renderDialog(true);

    await waitFor(() =>
      expect(screen.getByText('Colore primario')).toBeTruthy(),
    );
    expect(screen.queryByDisplayValue('#18181b')).toBeNull();
  });

  it('pre-fills the enabled color from the current site', async () => {
    vi.mocked(api.getSite).mockResolvedValue(
      buildSite({ themePrimaryColor: '#ff0000' }),
    );
    renderDialog(true);

    await waitFor(() => expect(screen.getByText('#ff0000')).toBeTruthy());
  });

  it('saves the colors category, passing through the other theme-settings fields unchanged', async () => {
    vi.mocked(api.getSite).mockResolvedValue(
      buildSite({ themeFontFamily: 'inter' }),
    );
    vi.mocked(api.updateThemeSettings).mockResolvedValue(buildSite());
    renderDialog(true);
    await waitFor(() => screen.getByText('Colore primario'));

    fireEvent.click(
      screen.getAllByRole('checkbox', { name: /personalizza/i })[0],
    );
    fireEvent.click(screen.getByRole('button', { name: /^salva$/i }));

    await waitFor(() =>
      expect(api.updateThemeSettings).toHaveBeenCalledWith(
        'site-1',
        expect.objectContaining({
          primaryColor: '#18181b',
          fontFamily: 'inter',
        }),
      ),
    );
  });

  it('switches to the Bottoni tab and saves button tokens', async () => {
    vi.mocked(api.getSite).mockResolvedValue(buildSite());
    vi.mocked(api.updateThemeTokens).mockResolvedValue(buildSite());
    renderDialog(true);
    await waitFor(() => screen.getByText('Colore primario'));

    fireEvent.click(screen.getByText('Bottoni'));
    fireEvent.change(screen.getByLabelText('Raggio angoli'), {
      target: { value: '9999px' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^salva$/i }));

    await waitFor(() =>
      expect(api.updateThemeTokens).toHaveBeenCalledWith('site-1', {
        buttons: { borderRadius: '9999px', paddingX: null, paddingY: null },
      }),
    );
  });

  it('closes without saving when Chiudi is clicked', async () => {
    vi.mocked(api.getSite).mockResolvedValue(buildSite());
    const onOpenChange = vi.fn();
    renderDialog(true, onOpenChange);
    await waitFor(() => screen.getByText('Colore primario'));

    fireEvent.click(screen.getByRole('button', { name: /chiudi/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(api.updateThemeSettings).not.toHaveBeenCalled();
  });
});
