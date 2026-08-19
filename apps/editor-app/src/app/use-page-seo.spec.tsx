import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as api from '../lib/pages-api-client.js';
import type { PageDto } from '../lib/pages-api-client.js';
import { createTestQueryClient } from '../test-query-client.js';
import { usePageSeo } from './use-page-seo.js';

vi.mock('../lib/pages-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/pages-api-client.js')>();
  return { ...actual, updateSeoMeta: vi.fn() };
});

const samplePage: PageDto = {
  id: 'page-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  groupId: 'group-1',
  parentId: null,
  locale: 'it',
  slug: 'chi-siamo',
  status: 'draft',
  content: [],
  publishedContent: null,
  seoMeta: { title: 'Nuovo titolo', description: 'Nuova descrizione' },
  createdAt: '',
  updatedAt: '',
};

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

describe('usePageSeo', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('updateSeoMeta updates the seoMeta for the page', async () => {
    vi.mocked(api.updateSeoMeta).mockResolvedValue(samplePage);

    const { result } = renderHook(() => usePageSeo('page-1'), { wrapper });

    await act(async () => {
      await result.current.updateSeoMeta({
        title: 'Nuovo titolo',
        description: 'Nuova descrizione',
      });
    });

    expect(api.updateSeoMeta).toHaveBeenCalledWith('page-1', {
      title: 'Nuovo titolo',
      description: 'Nuova descrizione',
    });
  });
});
