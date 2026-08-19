import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { Data } from '@puckeditor/core';
import * as api from '../lib/pages-api-client.js';
import { createTestQueryClient } from '../test-query-client.js';
import { pageQueryOptions } from './pages-queries.js';
import { usePageEditor } from './use-page-editor.js';

vi.mock('../lib/pages-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/pages-api-client.js')>();
  return { ...actual, saveDraft: vi.fn(), publishPage: vi.fn() };
});

const samplePage: api.PageDto = {
  id: 'page-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  groupId: 'group-1',
  parentId: null,
  locale: 'it',
  slug: 'test-page',
  status: 'draft',
  content: [],
  publishedContent: null,
  seoMeta: { title: 'Test', description: 'desc' },
  createdAt: '',
  updatedAt: '',
};

const emptyData: Data = { root: {}, content: [], zones: {} };

// Pre-seeds the query cache so useSuspenseQuery resolves synchronously —
// these tests exercise the mutations, not the initial fetch/suspense path.
function renderPageEditor() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(
    pageQueryOptions(samplePage.id).queryKey,
    samplePage,
  );
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return renderHook(() => usePageEditor(samplePage.id), { wrapper });
}

describe('usePageEditor', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('starts with the cached page and idle status', () => {
    const { result } = renderPageEditor();

    expect(result.current.page).toEqual(samplePage);
    expect(result.current.status).toEqual({ kind: 'idle' });
  });

  it('handleChange debounces and saves the draft', async () => {
    vi.useFakeTimers();
    vi.mocked(api.saveDraft).mockResolvedValue(samplePage);

    const { result } = renderPageEditor();

    act(() => result.current.handleChange(emptyData));
    expect(api.saveDraft).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(api.saveDraft).toHaveBeenCalledWith(samplePage.id, []);
    expect(result.current.status).toEqual({ kind: 'saved' });
  });

  it('handleChange sets an error status when the debounced save fails', async () => {
    vi.useFakeTimers();
    vi.mocked(api.saveDraft).mockRejectedValue(new Error('save failed'));

    const { result } = renderPageEditor();

    act(() => result.current.handleChange(emptyData));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(result.current.status).toEqual({
      kind: 'error',
      message: expect.stringContaining('save failed'),
    });
  });

  it('a pending debounced save does not fire after unmount', async () => {
    vi.useFakeTimers();
    vi.mocked(api.saveDraft).mockResolvedValue(samplePage);

    const { result, unmount } = renderPageEditor();
    act(() => result.current.handleChange(emptyData));
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(api.saveDraft).not.toHaveBeenCalled();
  });

  it('handlePublish saves the draft then publishes', async () => {
    vi.mocked(api.saveDraft).mockResolvedValue(samplePage);
    vi.mocked(api.publishPage).mockResolvedValue({
      ...samplePage,
      status: 'published',
    });

    const { result } = renderPageEditor();

    await act(async () => {
      await result.current.handlePublish(emptyData);
    });

    expect(api.saveDraft).toHaveBeenCalledWith(samplePage.id, []);
    expect(api.publishPage).toHaveBeenCalledWith(samplePage.id);
    expect(result.current.status).toEqual({ kind: 'published' });
  });
});
