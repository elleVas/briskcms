import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as api from '../lib/page-groups-api-client';
import type {
  PageGroupListItemRecord,
  PageTranslationRecord,
} from '../lib/page-groups-api-client';
import { createTestQueryClient } from '../test-query-client';
import { useRepresentativePage } from './use-representative-page';

vi.mock('../lib/page-groups-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/page-groups-api-client')>();
  return {
    ...actual,
    listPageGroups: vi.fn(),
    listPageGroupTranslations: vi.fn(),
  };
});

function group(
  overrides: Partial<PageGroupListItemRecord> = {},
): PageGroupListItemRecord {
  return {
    id: 'group-1',
    tenantId: 'tenant-1',
    siteId: 'site-1',
    parentId: null,
    order: 0,
    createdByName: null,
    createdAt: '',
    updatedAt: '',
    translations: [
      {
        locale: 'it',
        slug: 'home',
        title: 'Home',
        status: 'published',
        isDiverged: false,
      },
    ],
    ...overrides,
  };
}

function translation(
  overrides: Partial<PageTranslationRecord> = {},
): PageTranslationRecord {
  return {
    id: 'translation-1',
    tenantId: 'tenant-1',
    siteId: 'site-1',
    pageGroupId: 'group-1',
    locale: 'it',
    slug: 'home',
    seoMeta: { title: 'Home', description: '' },
    fieldValues: {},
    status: 'published',
    publishedSnapshot: [],
    isDiverged: false,
    divergedContent: null,
    createdBy: null,
    createdAt: '',
    updatedAt: '',
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

  it('returns the first matching-locale translation of the first group', async () => {
    vi.mocked(api.listPageGroups).mockResolvedValue({
      items: [group({ id: 'group-1' })],
      total: 1,
    });
    vi.mocked(api.listPageGroupTranslations).mockResolvedValue([
      translation({ id: 'it-translation-1', locale: 'it' }),
      translation({ id: 'it-translation-2', locale: 'it' }),
    ]);
    const { wrapper } = renderWithClient();

    const { result } = renderHook(() => useRepresentativePage('site-1', 'it'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.page?.id).toBe('it-translation-1');
    expect(api.listPageGroupTranslations).toHaveBeenCalledWith('group-1');
  });

  it('returns null when no group has a translation in that locale', async () => {
    vi.mocked(api.listPageGroups).mockResolvedValue({ items: [], total: 0 });
    const { wrapper } = renderWithClient();

    const { result } = renderHook(() => useRepresentativePage('site-1', 'it'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.page).toBeNull();
    expect(api.listPageGroupTranslations).not.toHaveBeenCalled();
  });
});
