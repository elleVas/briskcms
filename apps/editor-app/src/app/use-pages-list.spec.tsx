import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as router from '@tanstack/react-router';
import * as api from '../lib/pages-api-client';
import { createTestQueryClient } from '../test-query-client';
import { usePagesList } from './use-pages-list';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return { ...actual, useNavigate: vi.fn() };
});

vi.mock('../lib/pages-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/pages-api-client')>();
  return {
    ...actual,
    createPage: vi.fn(),
    deletePage: vi.fn(),
    publishPage: vi.fn(),
  };
});

const samplePage: api.PageRecord = {
  id: 'page-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  groupId: 'group-1',
  parentId: null,
  locale: 'it',
  slug: 'chi-siamo',
  status: 'draft',
  syncedStructureSignature: null,
  content: [],
  publishedContent: null,
  seoMeta: { title: 'Chi siamo', description: '' },
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

describe('usePagesList', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('createPage slugifies the given name and navigates to the new editor', async () => {
    const navigate = vi.fn();
    vi.mocked(router.useNavigate).mockReturnValue(navigate);
    vi.mocked(api.createPage).mockResolvedValue(samplePage);

    const { result } = renderHook(() => usePagesList('site-1', 'it'), {
      wrapper,
    });

    await act(async () => {
      await result.current.createPage('Chi Siamo', null);
    });

    expect(api.createPage).toHaveBeenCalledWith(
      expect.objectContaining({
        siteId: 'site-1',
        slug: 'chi-siamo',
        parentId: null,
        seoMeta: { title: 'Chi Siamo', description: '' },
      }),
    );
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/pages/$pageId',
        params: { pageId: samplePage.id },
      }),
    );
  });

  it('deletePage removes the page', async () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());
    vi.mocked(api.deletePage).mockResolvedValue(undefined);

    const { result } = renderHook(() => usePagesList('site-1', 'it'), {
      wrapper,
    });

    await act(async () => {
      await result.current.deletePage(samplePage.id);
    });

    expect(api.deletePage).toHaveBeenCalledWith(samplePage.id);
  });

  it('publishPage publishes the page', async () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());
    vi.mocked(api.publishPage).mockResolvedValue({
      ...samplePage,
      status: 'published',
    });

    const { result } = renderHook(() => usePagesList('site-1', 'it'), {
      wrapper,
    });

    await act(async () => {
      await result.current.publishPage(samplePage.id);
    });

    expect(api.publishPage).toHaveBeenCalledWith(samplePage.id);
  });
});
