import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '../components/ui/tooltip.js';
import * as api from '../lib/sites-api-client.js';
import type { SiteRecord } from '@brisk/shared-types';
import { createTestQueryClient } from '../test-query-client.js';
import { BusinessInfoDialog } from './business-info-dialog.js';

vi.mock('../lib/sites-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/sites-api-client.js')>();
  return { ...actual, getSite: vi.fn(), updateBusinessInfo: vi.fn() };
});

const sampleSite: SiteRecord = {
  id: 'site-1',
  tenantId: 'tenant-1',
  name: 'Il mio sito',
  domain: 'example.com',
  defaultLocale: 'it',
  enabledLocales: ['it'],
  untranslatedPageFallback: 'redirect-to-default',
  businessAddress: 'Via Roma 1, Milano',
  businessPhone: '+39 02 1234567',
  businessType: 'Restaurant',
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
  themeTokens: { blockStyles: {} },
  createdAt: '',
};

function renderDialog(open = true, onOpenChange = vi.fn()) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <TooltipProvider>
        <BusinessInfoDialog
          siteId="site-1"
          open={open}
          onOpenChange={onOpenChange}
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('BusinessInfoDialog', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch the site when closed', () => {
    vi.mocked(api.getSite).mockResolvedValue(sampleSite);

    renderDialog(false);

    expect(api.getSite).not.toHaveBeenCalled();
  });

  it('loads and pre-fills the form with the site business info', async () => {
    vi.mocked(api.getSite).mockResolvedValue(sampleSite);

    renderDialog();

    expect(await screen.findByDisplayValue('Via Roma 1, Milano')).toBeTruthy();
    expect(screen.getByDisplayValue('+39 02 1234567')).toBeTruthy();
    expect(screen.getByDisplayValue('Restaurant')).toBeTruthy();
  });

  it('saves the edited business info', async () => {
    vi.mocked(api.getSite).mockResolvedValue(sampleSite);
    vi.mocked(api.updateBusinessInfo).mockResolvedValue(sampleSite);

    renderDialog();
    const addressInput = await screen.findByDisplayValue('Via Roma 1, Milano');
    fireEvent.change(addressInput, { target: { value: 'Via Milano 2' } });
    fireEvent.click(screen.getByRole('button', { name: /^salva$/i }));

    await waitFor(() =>
      expect(api.updateBusinessInfo).toHaveBeenCalledWith(
        'site-1',
        expect.objectContaining({ businessAddress: 'Via Milano 2' }),
      ),
    );
  });

  it('sends null for blank optional fields, not empty strings', async () => {
    vi.mocked(api.getSite).mockResolvedValue({
      ...sampleSite,
      businessAddress: null,
      businessPhone: null,
      businessType: null,
    });
    vi.mocked(api.updateBusinessInfo).mockResolvedValue(sampleSite);

    renderDialog();
    await screen.findByLabelText('Indirizzo');
    fireEvent.click(screen.getByRole('button', { name: /^salva$/i }));

    await waitFor(() =>
      expect(api.updateBusinessInfo).toHaveBeenCalledWith('site-1', {
        businessAddress: null,
        businessPhone: null,
        businessType: null,
        openingHours: null,
      }),
    );
  });
});
