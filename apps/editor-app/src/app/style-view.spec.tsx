import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { SiteRecord } from '@brisk/shared-types';
import * as api from '../lib/sites-api-client.js';
import { createTestQueryClient } from '../test-query-client.js';
import { StyleView } from './style-view.js';

vi.mock('../lib/sites-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/sites-api-client.js')>();
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
  themePrimaryColor: null,
  themeSecondaryColor: null,
  themeFontFamily: null,
  themeCustomCss: null,
  themeHeadScript: null,
  themeBodyScript: null,
  themeFaviconUrl: null,
  themeOverridesEnabled: true,
  themeTokens: { blockStyles: {} },
  createdAt: '',
};

function renderView(overrides: Partial<SiteRecord> = {}) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <StyleView siteId="site-1" site={{ ...site, ...overrides }} />
    </QueryClientProvider>,
  );
}

describe('StyleView', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the title and current overrides-enabled state', () => {
    renderView();

    expect(screen.getByText('Stile del sito')).toBeTruthy();
    const toggle = screen.getByRole('switch', {
      name: /applica queste impostazioni/i,
    });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('pre-fills the primary color toggle from an existing site value', () => {
    renderView({ themePrimaryColor: '#123456' });

    expect(screen.getByDisplayValue('#123456')).toBeTruthy();
  });

  it('saves theme settings and shows a confirmation', async () => {
    vi.mocked(api.updateThemeSettings).mockResolvedValue({
      ...site,
      themeOverridesEnabled: true,
    });

    renderView();
    fireEvent.click(screen.getByRole('button', { name: /^salva$/i }));

    await waitFor(() =>
      expect(api.updateThemeSettings).toHaveBeenCalledWith(
        'site-1',
        expect.objectContaining({ overridesEnabled: true }),
      ),
    );
    expect(await screen.findByText('Salvato')).toBeTruthy();
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
