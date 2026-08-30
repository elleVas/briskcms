import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as api from '../lib/pages-api-client';
import { createTestQueryClient } from '../test-query-client';
import { useRepresentativePage } from './use-representative-page';

vi.mock('../lib/pages-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/pages-api-client')>();
  return { ...actual, listPages: vi.fn() };
});

function page(overrides: Partial<api.PageListItem>): api.PageListItem {
  return {
    id: 'page-1',
    tenantId: 'tenant-1',
    siteId: 'site-1',
    groupId: 'group-1',
    parentId: null,
    locale: 'it',
    slug: 'home',
    status: 'published',
    seoMeta: { title: 'Home', description: '' },
    createdAt: '',
    updatedAt: '',
    hasUnpublishedChanges: false,
    ...overrides,
  };
}

function renderWithClient() {
  const queryClient = createTestQueryClient();
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return { wrapper };
}

describe('useRepresentativePage', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns the first page matching the requested locale', async () => {
    vi.mocked(api.listPages).mockResolvedValue({
      items: [
        page({ id: 'en-page', locale: 'en' }),
        page({ id: 'it-page-1', locale: 'it' }),
        page({ id: 'it-page-2', locale: 'it' }),
      ],
      total: 3,
    });
    const { wrapper } = renderWithClient();

    const { result } = renderHook(() => useRepresentativePage('site-1', 'it'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.page?.id).toBe('it-page-1');
  });

  it('returns null when no page exists in that locale', async () => {
    vi.mocked(api.listPages).mockResolvedValue({
      items: [page({ id: 'en-page', locale: 'en' })],
      total: 1,
    });
    const { wrapper } = renderWithClient();

    const { result } = renderHook(() => useRepresentativePage('site-1', 'it'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.page).toBeNull();
  });
});
