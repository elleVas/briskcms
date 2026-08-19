import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as api from '../lib/site-layout-sections-api-client.js';
import { createTestQueryClient } from '../test-query-client.js';
import { useSiteLayoutSectionVersions } from './use-site-layout-section-versions.js';

vi.mock('../lib/site-layout-sections-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../lib/site-layout-sections-api-client.js')
    >();
  return {
    ...actual,
    listVersions: vi.fn(),
    rollbackToVersion: vi.fn(),
  };
});

const sampleVersion: api.SiteLayoutSectionVersionDto = {
  id: 'version-1',
  tenantId: 'tenant-1',
  siteLayoutSectionId: 'section-1',
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

describe('useSiteLayoutSectionVersions', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch versions while disabled', () => {
    vi.mocked(api.listVersions).mockResolvedValue([sampleVersion]);

    renderHook(
      () =>
        useSiteLayoutSectionVersions(
          'section-1',
          'site-1',
          'it',
          'header',
          false,
        ),
      { wrapper },
    );

    expect(api.listVersions).not.toHaveBeenCalled();
  });

  it('fetches versions once enabled', async () => {
    vi.mocked(api.listVersions).mockResolvedValue([sampleVersion]);

    const { result } = renderHook(
      () =>
        useSiteLayoutSectionVersions(
          'section-1',
          'site-1',
          'it',
          'header',
          true,
        ),
      { wrapper },
    );

    await waitFor(() =>
      expect(result.current.versions).toEqual([sampleVersion]),
    );
    expect(api.listVersions).toHaveBeenCalledWith('section-1');
  });

  it('rollback calls the API with the given version id', async () => {
    vi.mocked(api.listVersions).mockResolvedValue([sampleVersion]);
    vi.mocked(api.rollbackToVersion).mockResolvedValue({
      id: 'section-1',
      tenantId: 'tenant-1',
      siteId: 'site-1',
      locale: 'it',
      kind: 'header',
      status: 'published',
      content: [],
      publishedContent: [],
      sticky: false,
      createdAt: '',
      updatedAt: '',
    });

    const { result } = renderHook(
      () =>
        useSiteLayoutSectionVersions(
          'section-1',
          'site-1',
          'it',
          'header',
          true,
        ),
      { wrapper },
    );

    await act(async () => {
      await result.current.rollback('version-1');
    });

    expect(api.rollbackToVersion).toHaveBeenCalledWith(
      'section-1',
      'version-1',
    );
  });
});
