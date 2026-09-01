import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as api from '../lib/page-groups-api-client';
import { createTestQueryClient } from '../test-query-client';
import { pageGroupTranslationsQueryOptions } from './page-groups-queries';
import { usePageTranslationSeo } from './use-page-translation-seo';

vi.mock('../lib/page-groups-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/page-groups-api-client')>();
  return { ...actual, updatePageTranslationSeoMeta: vi.fn() };
});

const translation: api.PageTranslationRecord = {
  id: 'translation-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  pageGroupId: 'group-1',
  locale: 'it',
  slug: 'home',
  seoMeta: { title: 'Home', description: '' },
  fieldValues: {},
  status: 'draft',
  publishedSnapshot: null,
  isDiverged: false,
  divergedContent: null,
  createdBy: null,
  createdAt: '',
  updatedAt: '',
};

function renderWithClient() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(
    pageGroupTranslationsQueryOptions('group-1').queryKey,
    [translation],
  );
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return { wrapper, queryClient };
}

describe('usePageTranslationSeo', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('saves the seoMeta and writes the result into the translations cache', async () => {
    const updated = {
      ...translation,
      seoMeta: { title: 'Nuova Home', description: 'aggiornata' },
    };
    vi.mocked(api.updatePageTranslationSeoMeta).mockResolvedValue(updated);
    const { wrapper, queryClient } = renderWithClient();

    const { result } = renderHook(
      () => usePageTranslationSeo('group-1', 'translation-1', null),
      { wrapper },
    );

    await act(async () => {
      await result.current.updateSeoMeta({
        title: 'Nuova Home',
        description: 'aggiornata',
      });
    });

    expect(api.updatePageTranslationSeoMeta).toHaveBeenCalledWith(
      'translation-1',
      { title: 'Nuova Home', description: 'aggiornata' },
      null,
    );
    expect(
      queryClient.getQueryData(
        pageGroupTranslationsQueryOptions('group-1').queryKey,
      ),
    ).toEqual([updated]);
  });
});
