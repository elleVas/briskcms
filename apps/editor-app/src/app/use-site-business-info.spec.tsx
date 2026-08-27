import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as api from '../lib/sites-api-client.js';
import type { SiteRecord } from '@brisk/shared-types';
import { createTestQueryClient } from '../test-query-client.js';
import { useSiteBusinessInfo } from './use-site-business-info.js';

vi.mock('../lib/sites-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/sites-api-client.js')>();
  return { ...actual, updateBusinessInfo: vi.fn() };
});

const sampleSite: SiteRecord = {
  id: 'site-1',
  tenantId: 'tenant-1',
  name: 'Il mio sito',
  domain: 'example.com',
  defaultLocale: 'it',
  enabledLocales: ['it'],
  untranslatedPageFallback: 'redirect-to-default',
  businessAddress: 'Via Roma 1',
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

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

describe('useSiteBusinessInfo', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('updateBusinessInfo updates the business info for the site', async () => {
    vi.mocked(api.updateBusinessInfo).mockResolvedValue(sampleSite);

    const { result } = renderHook(() => useSiteBusinessInfo('site-1'), {
      wrapper,
    });

    await act(async () => {
      await result.current.updateBusinessInfo({
        businessAddress: 'Via Roma 1',
        businessPhone: null,
        businessType: null,
        openingHours: null,
      });
    });

    expect(api.updateBusinessInfo).toHaveBeenCalledWith('site-1', {
      businessAddress: 'Via Roma 1',
      businessPhone: null,
      businessType: null,
      openingHours: null,
    });
  });
});
