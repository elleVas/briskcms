import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '../components/ui/tooltip';
import * as api from '../lib/sites-api-client';
import { buildSiteRecord } from '@brisk/testing/records';
import { createTestQueryClient } from '../test/query-client.test-fixture';
import { BusinessInfoDialog } from './business-info-dialog';

vi.mock('../lib/sites-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/sites-api-client')>();
  return { ...actual, getCurrentSite: vi.fn(), updateBusinessInfo: vi.fn() };
});

const sampleSite = buildSiteRecord({
  businessAddress: 'Via Roma 1, Milano',
  businessPhone: '+39 02 1234567',
  businessType: 'Restaurant',
});

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
    vi.mocked(api.getCurrentSite).mockResolvedValue(sampleSite);

    renderDialog(false);

    expect(api.getCurrentSite).not.toHaveBeenCalled();
  });

  it('loads and pre-fills the form with the site business info', async () => {
    vi.mocked(api.getCurrentSite).mockResolvedValue(sampleSite);

    renderDialog();

    expect(await screen.findByDisplayValue('Via Roma 1, Milano')).toBeTruthy();
    expect(screen.getByDisplayValue('+39 02 1234567')).toBeTruthy();
    expect(screen.getByDisplayValue('Restaurant')).toBeTruthy();
  });

  it('saves the edited business info', async () => {
    vi.mocked(api.getCurrentSite).mockResolvedValue(sampleSite);
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

  it('saves the email, and says so under the field when it is not one', async () => {
    vi.mocked(api.getCurrentSite).mockResolvedValue(sampleSite);
    vi.mocked(api.updateBusinessInfo).mockResolvedValue(sampleSite);

    renderDialog();
    const email = await screen.findByLabelText('Email');
    fireEvent.change(email, { target: { value: 'non-una-email' } });
    fireEvent.click(screen.getByRole('button', { name: /^salva$/i }));

    expect(
      await screen.findByText('Questo non sembra un indirizzo email.'),
    ).toBeTruthy();
    expect(api.updateBusinessInfo).not.toHaveBeenCalled();

    fireEvent.change(email, { target: { value: ' ciao@example.com ' } });
    fireEvent.click(screen.getByRole('button', { name: /^salva$/i }));

    await waitFor(() =>
      expect(api.updateBusinessInfo).toHaveBeenCalledWith(
        'site-1',
        expect.objectContaining({ businessEmail: 'ciao@example.com' }),
      ),
    );
  });

  it('sends null for blank optional fields, not empty strings', async () => {
    vi.mocked(api.getCurrentSite).mockResolvedValue({
      ...sampleSite,
      businessAddress: null,
      businessPhone: null,
      businessEmail: null,
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
        businessEmail: null,
        businessType: null,
        openingHours: null,
      }),
    );
  });
});
