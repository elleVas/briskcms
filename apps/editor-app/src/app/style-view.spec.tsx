import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { SiteRecord } from '@brisk/shared-types';
import { DEFAULT_COOKIE_BANNER_SETTINGS } from '@brisk/shared-types';
import * as api from '../lib/sites-api-client';
import * as themeApi from '../lib/theme-api-client';
import { createTestQueryClient } from '../test-query-client';
import { StyleView } from './style-view';

vi.mock('../lib/sites-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/sites-api-client')>();
  return { ...actual, updateThemeSettings: vi.fn() };
});

// No resolved defaults in these tests — without a mock the query would make
// a real network fetch (the same reason as the equivalent mock in
// global-styles-dialog.spec.tsx).
vi.mock('../lib/theme-api-client', () => ({
  fetchThemeForegroundTokens: vi.fn().mockResolvedValue({
    primaryForeground: '#ffffff',
    secondaryForeground: '#000000',
  }),
  fetchThemeCapabilities: vi.fn().mockResolvedValue({
    allowStyleOverrides: true,
  }),
}));

const site: SiteRecord = {
  id: 'site-1',
  tenantId: 'tenant-1',
  name: 'Il mio sito',
  domain: null,
  themeName: 'classic',
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
  themeContentWidth: null,
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

  it('shows a contrast warning when the enabled primary color is too close to the theme foreground', async () => {
    // Mocked theme foreground is #ffffff — a white primary color has zero
    // contrast against it.
    renderView({ themePrimaryColor: '#ffffff' });

    expect(await screen.findByText(/Contrasto basso/)).toBeTruthy();
  });

  it('shows no contrast warning when no color is enabled', () => {
    renderView();

    expect(screen.queryByText(/Contrasto basso/)).toBeNull();
  });

  it('saves theme settings and shows a confirmation', async () => {
    vi.mocked(api.updateThemeSettings).mockResolvedValue({
      ...site,
      themeOverridesEnabled: true,
      themeAllowedTrackerDomains: [],
      formSubmissionRetentionDays: null,
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

/**
 * A theme may refuse to be dressed at all (docs/adr/0021). This page used
 * to be unable to tell: its own switch said "the active theme can also
 * lock this off entirely — see its own documentation", which is an
 * admission that the editor did not know. Now it does.
 */
describe('StyleView under a theme that refuses styling', () => {
  it('says so, and turns the fields off whatever the site switch says', async () => {
    vi.mocked(themeApi.fetchThemeCapabilities).mockResolvedValue({
      allowStyleOverrides: false,
    });

    const { container } = renderView({ themeOverridesEnabled: true });

    expect(
      await screen.findByText(
        /tema attivo non permette a un sito di stilarlo/i,
      ),
    ).toBeTruthy();
    // `inert` is what actually stops the fields being usable — asserting
    // on the greyed-out class would pass on a page that still accepts
    // input.
    await waitFor(() => {
      expect(container.querySelector('[inert]')).not.toBeNull();
    });
  });

  it('leaves the fields alone when the theme allows it', async () => {
    vi.mocked(themeApi.fetchThemeCapabilities).mockResolvedValue({
      allowStyleOverrides: true,
    });

    const { container } = renderView({ themeOverridesEnabled: true });

    await waitFor(() => {
      expect(container.querySelector('[inert]')).toBeNull();
    });
  });
});
