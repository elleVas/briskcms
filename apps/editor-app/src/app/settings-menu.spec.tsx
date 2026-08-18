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

  it('opens the business info dialog from the settings popover', async () => {
    vi.mocked(api.getSite).mockResolvedValue({
      id: 'site-1',
      tenantId: 'tenant-1',
      name: 'Il mio sito',
      domain: null,
      defaultLocale: 'it',
      enabledLocales: ['it'],
      businessAddress: null,
      businessPhone: null,
      businessType: null,
      openingHours: null,
      createdAt: '',
    });

    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /^impostazioni$/i }));
    fireEvent.click(screen.getByRole('button', { name: /dati attività/i }));

    expect(
      await screen.findByRole('heading', { name: /dati attività/i }),
    ).toBeTruthy();
  });
});
