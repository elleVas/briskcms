import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '../components/ui/tooltip.js';
import * as api from '../lib/sites-api-client.js';
import { createTestQueryClient } from '../test-query-client.js';
import { SettingsMenu } from './settings-menu.js';

vi.mock('../lib/sites-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/sites-api-client.js')>();
  return { ...actual, getSite: vi.fn() };
});

function renderMenu() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <TooltipProvider>
        <SettingsMenu />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('SettingsMenu', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  function mockSite(overrides: Partial<api.SiteDto> = {}): api.SiteDto {
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
      createdAt: '',
      ...overrides,
    };
  }

  it('opens the business info dialog from the settings popover', async () => {
    vi.mocked(api.getSite).mockResolvedValue(mockSite());

    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /^impostazioni$/i }));
    fireEvent.click(screen.getByRole('button', { name: /dati attività/i }));

    expect(
      await screen.findByRole('heading', { name: /dati attività/i }),
    ).toBeTruthy();
  });

  it('opens the general settings dialog from the settings popover', async () => {
    vi.mocked(api.getSite).mockResolvedValue(mockSite());

    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /^impostazioni$/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /impostazioni generali/i }),
    );

    expect(
      await screen.findByRole('heading', { name: /impostazioni generali/i }),
    ).toBeTruthy();
  });

  it('opens the SEO settings dialog from the settings popover', async () => {
    vi.mocked(api.getSite).mockResolvedValue(mockSite());

    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /^impostazioni$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^seo sito$/i }));

    expect(
      await screen.findByRole('heading', { name: /^seo sito$/i }),
    ).toBeTruthy();
  });

  it('opens the locale settings dialog from the settings popover', async () => {
    vi.mocked(api.getSite).mockResolvedValue(mockSite());

    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /^impostazioni$/i }));
    fireEvent.click(screen.getByRole('button', { name: /lingue/i }));

    expect(
      await screen.findByRole('heading', { name: /lingue/i }),
    ).toBeTruthy();
  });

  it('opens the theme settings dialog from the settings popover', async () => {
    vi.mocked(api.getSite).mockResolvedValue(mockSite());

    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /^impostazioni$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^stile$/i }));

    expect(
      await screen.findByRole('heading', { name: /stile del sito/i }),
    ).toBeTruthy();
  });
});
