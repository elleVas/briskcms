import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { optionNames } from '../test/select.test-fixture';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { ISO_COUNTRY_CODES } from '@brisk/shared-types';
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
  businessAddress: {
    street: 'Via Roma 1',
    postalCode: '20121',
    city: 'Milano',
    country: 'IT',
  },
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

    expect(await screen.findByDisplayValue('Via Roma 1')).toBeTruthy();
    expect(screen.getByDisplayValue('20121')).toBeTruthy();
    expect(screen.getByDisplayValue('Milano')).toBeTruthy();
    // The stored `IT` selects the country, shown under the name the
    // platform gives it rather than one from a table of ours.
    expect(screen.getByLabelText('Paese').textContent).toContain('Italia');
    expect(screen.getByDisplayValue('+39 02 1234567')).toBeTruthy();
    expect(screen.getByDisplayValue('Restaurant')).toBeTruthy();
  });

  it("offers the countries named in the editor's own language", async () => {
    vi.mocked(api.getCurrentSite).mockResolvedValue(sampleSite);

    renderDialog();

    const country = await screen.findByLabelText('Paese');
    const [none, ...names] = optionNames(country);
    expect(none).toBe('— Nessuno —');
    expect(names).toHaveLength(ISO_COUNTRY_CODES.length);
    expect(names).toContain('Italia');
    // Sorted by the name as it reads in this language, not by the code.
    expect(names).toEqual([...names].sort(new Intl.Collator('it').compare));
  });

  it('saves the edited business info', async () => {
    vi.mocked(api.getCurrentSite).mockResolvedValue(sampleSite);
    vi.mocked(api.updateBusinessInfo).mockResolvedValue(sampleSite);

    renderDialog();
    fireEvent.change(await screen.findByLabelText('Via e numero'), {
      target: { value: 'Via Milano 2' },
    });
    fireEvent.change(screen.getByLabelText('CAP'), {
      target: { value: '00184' },
    });
    fireEvent.change(screen.getByLabelText('Città'), {
      target: { value: 'Roma' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^salva$/i }));

    await waitFor(() =>
      expect(api.updateBusinessInfo).toHaveBeenCalledWith(
        'site-1',
        expect.objectContaining({
          businessAddress: {
            street: 'Via Milano 2',
            postalCode: '00184',
            city: 'Roma',
            country: 'IT',
          },
        }),
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
    await screen.findByLabelText('Via e numero');
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
