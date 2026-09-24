import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as api from '../lib/sites-api-client';
import { buildSiteRecord } from '@brisk/testing/records';
import { createTestQueryClient } from '../test/query-client.test-fixture';
import { useSiteBusinessInfo } from './use-site-business-info';

vi.mock('../lib/sites-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/sites-api-client')>();
  return { ...actual, updateBusinessInfo: vi.fn() };
});

const sampleSite = buildSiteRecord({
  businessAddress: {
    street: 'Via Roma 1',
    postalCode: '20121',
    city: 'Milano',
    country: 'IT',
  },
});

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
        businessAddress: {
          street: 'Via Roma 1',
          postalCode: '20121',
          city: 'Milano',
          country: 'IT',
        },
        businessPhone: null,
        businessEmail: null,
        businessType: null,
        openingHours: null,
      });
    });

    expect(api.updateBusinessInfo).toHaveBeenCalledWith('site-1', {
      businessAddress: {
        street: 'Via Roma 1',
        postalCode: '20121',
        city: 'Milano',
        country: 'IT',
      },
      businessPhone: null,
      businessEmail: null,
      businessType: null,
      openingHours: null,
    });
  });
});
