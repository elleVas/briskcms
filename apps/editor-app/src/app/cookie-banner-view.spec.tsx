import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { SiteRecord } from '@brisk/shared-types';
import { DEFAULT_COOKIE_BANNER_SETTINGS } from '@brisk/shared-types';
import * as api from '../lib/sites-api-client';
import { createTestQueryClient } from '../test-query-client';
import { TooltipProvider } from '../components/ui/tooltip';
import { CookieBannerView } from './cookie-banner-view';

vi.mock('../lib/sites-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/sites-api-client')>();
  return { ...actual, updateCookieBannerSettings: vi.fn() };
});

const site: SiteRecord = {
  id: 'site-1',
  tenantId: 'tenant-1',
  name: 'Il mio sito',
  domain: null,
  defaultLocale: 'it',
  enabledLocales: ['it', 'en'],
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
  themeAllowedTrackerDomains: [],
  formSubmissionRetentionDays: null,
  themeTrackerScripts: [],
  cookieBannerSettings: DEFAULT_COOKIE_BANNER_SETTINGS,
  themeTokens: { blockStyles: {} },
  createdAt: '',
};

function renderView(overrides: Partial<SiteRecord> = {}) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <TooltipProvider>
        <CookieBannerView siteId="site-1" site={{ ...site, ...overrides }} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('CookieBannerView', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the title, disabled by default', () => {
    renderView();

    expect(screen.getByText('Cookie banner')).toBeTruthy();
    expect(screen.queryByText('Posizione')).toBeNull();
  });

  it('reveals the config once the banner is enabled', () => {
    renderView({
      cookieBannerSettings: {
        ...DEFAULT_COOKIE_BANNER_SETTINGS,
        enabled: true,
      },
    });

    expect(screen.getByText('Posizione')).toBeTruthy();
    expect(screen.getByText('Lato del bottone di accettazione')).toBeTruthy();
  });

  it('shows the reopen tab position only when the reopen tab is on', () => {
    renderView({
      cookieBannerSettings: {
        ...DEFAULT_COOKIE_BANNER_SETTINGS,
        enabled: true,
        showReopenTab: false,
      },
    });

    expect(
      screen.queryByText('Posizione della linguetta di riapertura'),
    ).toBeNull();
  });

  it('saves the enabled toggle, round-tripping the rest of the settings unchanged', async () => {
    vi.mocked(api.updateCookieBannerSettings).mockResolvedValue(site);
    renderView();

    fireEvent.click(
      screen.getByRole('switch', { name: /mostra il cookie banner/i }),
    );
    fireEvent.click(screen.getByRole('button', { name: /^salva$/i }));

    await waitFor(() =>
      expect(api.updateCookieBannerSettings).toHaveBeenCalledWith('site-1', {
        ...DEFAULT_COOKIE_BANNER_SETTINGS,
        enabled: true,
      }),
    );
    expect(await screen.findByText('Salvato')).toBeTruthy();
  });

  it('shows an error message when saving fails', async () => {
    vi.mocked(api.updateCookieBannerSettings).mockRejectedValue(
      new Error('network down'),
    );

    renderView();
    fireEvent.click(screen.getByRole('button', { name: /^salva$/i }));

    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('renders one copy-override section per enabled locale', () => {
    renderView({
      cookieBannerSettings: {
        ...DEFAULT_COOKIE_BANNER_SETTINGS,
        enabled: true,
      },
    });

    expect(screen.getByText('it')).toBeTruthy();
    expect(screen.getByText('en')).toBeTruthy();
  });
});
