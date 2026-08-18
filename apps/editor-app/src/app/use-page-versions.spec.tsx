import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as api from '../lib/pages-api-client.js';
import { createTestQueryClient } from '../test-query-client.js';
import { usePageVersions } from './use-page-versions.js';

vi.mock('../lib/pages-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/pages-api-client.js')>();
  return {
    ...actual,
    listPageVersions: vi.fn(),
    rollbackToVersion: vi.fn(),
  };
});

const sampleVersion: api.PageVersionDto = {
  id: 'version-1',
  tenantId: 'tenant-1',
  pageId: 'page-1',
  content: [],
  createdBy: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

describe('usePageVersions', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch versions while disabled', () => {
    vi.mocked(api.listPageVersions).mockResolvedValue([sampleVersion]);

    renderHook(() => usePageVersions('page-1', false), { wrapper });

    expect(api.listPageVersions).not.toHaveBeenCalled();
  });

  it('fetches versions once enabled', async () => {
    vi.mocked(api.listPageVersions).mockResolvedValue([sampleVersion]);

    const { result } = renderHook(() => usePageVersions('page-1', true), {
      wrapper,
    });

    await waitFor(() =>
      expect(result.current.versions).toEqual([sampleVersion]),
    );
    expect(api.listPageVersions).toHaveBeenCalledWith('page-1');
  });

  it('rollback calls the API with the given version id', async () => {
    vi.mocked(api.listPageVersions).mockResolvedValue([sampleVersion]);
    vi.mocked(api.rollbackToVersion).mockResolvedValue({
      id: 'page-1',
      tenantId: 'tenant-1',
      siteId: 'site-1',
      groupId: 'group-1',
      locale: 'it',
      slug: 'chi-siamo',
      status: 'published',
      content: [],
      publishedContent: [],
      seoMeta: { title: 'Chi siamo', description: '' },
      createdAt: '',
      updatedAt: '',
    });

    const { result } = renderHook(() => usePageVersions('page-1', true), {
      wrapper,
    });

    await act(async () => {
      await result.current.rollback('version-1');
    });

    expect(api.rollbackToVersion).toHaveBeenCalledWith('page-1', 'version-1');
  });
});
