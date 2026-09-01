import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as router from '@tanstack/react-router';
import * as api from '../lib/page-groups-api-client';
import { createTestQueryClient } from '../test-query-client';
import { usePageGroupsList } from './use-page-groups-list';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return { ...actual, useNavigate: vi.fn() };
});

vi.mock('../lib/page-groups-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/page-groups-api-client')>();
  return {
    ...actual,
    createPageGroup: vi.fn(),
    createPageGroupTranslation: vi.fn(),
    deletePageGroup: vi.fn(),
    duplicatePageGroup: vi.fn(),
    reorderPageGroups: vi.fn(),
  };
});

const sampleGroup: api.PageGroupRecord = {
  id: 'group-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  parentId: null,
  order: 0,
  content: [],
  createdBy: null,
  createdAt: '',
  updatedAt: '',
};

const sampleTranslation: api.PageTranslationRecord = {
  id: 'translation-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  pageGroupId: 'group-1',
  locale: 'it',
  slug: 'chi-siamo',
  seoMeta: { title: 'Chi Siamo', description: '' },
  fieldValues: {},
  status: 'draft',
  publishedSnapshot: null,
  isDiverged: false,
  divergedContent: null,
  createdBy: null,
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

describe('usePageGroupsList', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('createPageGroup creates the group, seeds a default-locale translation from the slugified name, and navigates to the new editor', async () => {
    const navigate = vi.fn();
    vi.mocked(router.useNavigate).mockReturnValue(navigate);
    vi.mocked(api.createPageGroup).mockResolvedValue(sampleGroup);
    vi.mocked(api.createPageGroupTranslation).mockResolvedValue(
      sampleTranslation,
    );

    const { result } = renderHook(() => usePageGroupsList('site-1', 'it'), {
      wrapper,
    });

    await act(async () => {
      await result.current.createPageGroup('Chi Siamo');
    });

    expect(api.createPageGroup).toHaveBeenCalledWith({ siteId: 'site-1' });
    expect(api.createPageGroupTranslation).toHaveBeenCalledWith('group-1', {
      locale: 'it',
      slug: 'chi-siamo',
      seoMeta: { title: 'Chi Siamo', description: '' },
    });
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/page-groups/$groupId',
        params: { groupId: sampleGroup.id },
      }),
    );
  });

  it('deletePageGroup removes the group', async () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());
    vi.mocked(api.deletePageGroup).mockResolvedValue(undefined);

    const { result } = renderHook(() => usePageGroupsList('site-1', 'it'), {
      wrapper,
    });

    await act(async () => {
      await result.current.deletePageGroup(sampleGroup.id);
    });

    expect(api.deletePageGroup).toHaveBeenCalledWith(sampleGroup.id);
  });

  it('duplicatePageGroup duplicates the group and navigates to the new editor', async () => {
    const navigate = vi.fn();
    vi.mocked(router.useNavigate).mockReturnValue(navigate);
    const duplicate = { ...sampleGroup, id: 'group-2' };
    vi.mocked(api.duplicatePageGroup).mockResolvedValue(duplicate);

    const { result } = renderHook(() => usePageGroupsList('site-1', 'it'), {
      wrapper,
    });

    await act(async () => {
      await result.current.duplicatePageGroup(sampleGroup.id);
    });

    expect(api.duplicatePageGroup).toHaveBeenCalledWith(sampleGroup.id);
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/page-groups/$groupId',
        params: { groupId: duplicate.id },
      }),
    );
  });

  it('reorderPageGroups threads parentId and the ordered ids through', async () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());
    vi.mocked(api.reorderPageGroups).mockResolvedValue(undefined);

    const { result } = renderHook(() => usePageGroupsList('site-1', 'it'), {
      wrapper,
    });

    await act(async () => {
      await result.current.reorderPageGroups(null, ['b', 'a']);
    });

    expect(api.reorderPageGroups).toHaveBeenCalledWith('site-1', null, [
      'b',
      'a',
    ]);
  });
});
