import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { SiteRecord } from '@brisk/shared-types';
import * as api from '../lib/sites-api-client';
import { createTestQueryClient } from '../test-query-client';
import { TooltipProvider } from '../components/ui/tooltip';
import { IntegrationsView } from './integrations-view';

vi.mock('../lib/sites-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/sites-api-client')>();
  return { ...actual, updateThemeSettings: vi.fn() };
});

const site: SiteRecord = {
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
  themePrimaryColor: '#18181b',
  themeSecondaryColor: null,
  themeFontFamily: null,
  themeCustomCss: null,
  themeHeadScript: null,
  themeBodyScript: null,
  themeFaviconUrl: null,
  themeOverridesEnabled: true,
  themeAllowedTrackerDomains: [],
  themeTokens: { blockStyles: {} },
  createdAt: '',
};

function renderView(overrides: Partial<SiteRecord> = {}) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <TooltipProvider>
        <IntegrationsView siteId="site-1" site={{ ...site, ...overrides }} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('IntegrationsView', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the title and pre-fills existing head/body scripts', () => {
    renderView({
      themeHeadScript: '<script>head</script>',
      themeBodyScript: '<script>body</script>',
    });

    expect(screen.getByText('Integrazioni')).toBeTruthy();
    expect(screen.getByDisplayValue('<script>head</script>')).toBeTruthy();
    expect(screen.getByDisplayValue('<script>body</script>')).toBeTruthy();
  });

  it('pre-fills existing tracker domains', () => {
    renderView({
      themeAllowedTrackerDomains: [
        { label: 'Hotjar', domain: 'static.hotjar.com' },
      ],
    });

    expect(screen.getByText('Hotjar')).toBeTruthy();
    expect(screen.getByText('static.hotjar.com')).toBeTruthy();
  });

  it('adds a tracker domain and saves it, round-tripping the fields this page does not own', async () => {
    vi.mocked(api.updateThemeSettings).mockResolvedValue(site);
    renderView();

    fireEvent.change(screen.getByPlaceholderText('Nome, es. Hotjar'), {
      target: { value: 'Hotjar' },
    });
    fireEvent.change(screen.getByPlaceholderText('es. static.hotjar.com'), {
      target: { value: 'static.hotjar.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /aggiungi dominio/i }));
    fireEvent.click(screen.getByRole('button', { name: /^salva$/i }));

    await waitFor(() =>
      expect(api.updateThemeSettings).toHaveBeenCalledWith(
        'site-1',
        expect.objectContaining({
          primaryColor: '#18181b',
          allowedTrackerDomains: [
            { label: 'Hotjar', domain: 'static.hotjar.com' },
          ],
        }),
      ),
    );
    expect(await screen.findByText('Salvato')).toBeTruthy();
  });

  it('rejects a domain with a scheme or path instead of silently accepting it', () => {
    renderView();

    fireEvent.change(screen.getByPlaceholderText('Nome, es. Hotjar'), {
      target: { value: 'Bad' },
    });
    fireEvent.change(screen.getByPlaceholderText('es. static.hotjar.com'), {
      target: { value: 'https://static.hotjar.com/x' },
    });
    fireEvent.click(screen.getByRole('button', { name: /aggiungi dominio/i }));

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByText('Bad')).toBeNull();
  });

  it('removes a tracker domain', () => {
    renderView({
      themeAllowedTrackerDomains: [
        { label: 'Hotjar', domain: 'static.hotjar.com' },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: /rimuovi dominio/i }));

    expect(screen.queryByText('Hotjar')).toBeNull();
  });

  it('shows an error message when saving fails', async () => {
    vi.mocked(api.updateThemeSettings).mockRejectedValue(
      new Error('network down'),
    );

    renderView();
    fireEvent.click(screen.getByRole('button', { name: /^salva$/i }));

    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});
