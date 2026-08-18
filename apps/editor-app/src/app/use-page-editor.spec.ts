import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Data } from '@puckeditor/core';
import * as api from '../lib/pages-api-client.js';
import { usePageEditor } from './use-page-editor.js';

vi.mock('../lib/pages-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/pages-api-client.js')>();
  return {
    ...actual,
    saveDraft: vi.fn(),
    publishPage: vi.fn(),
  };
});

const samplePage: api.PageDto = {
  id: 'page-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  groupId: 'group-1',
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

describe('usePageEditor', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('starts with the given page and no status', () => {
    const { result } = renderHook(() => usePageEditor(samplePage));

    expect(result.current.page).toEqual(samplePage);
    expect(result.current.status).toBe('');
  });

  it('handleChange debounces and saves the draft', async () => {
    vi.useFakeTimers();
    vi.mocked(api.saveDraft).mockResolvedValue(samplePage);

    const { result } = renderHook(() => usePageEditor(samplePage));

    act(() => result.current.handleChange(emptyData));
    expect(api.saveDraft).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(api.saveDraft).toHaveBeenCalledWith(samplePage.id, []);
    expect(result.current.status).toBe('Bozza salvata');
  });

  it('handleChange sets an error status when the debounced save fails', async () => {
    vi.useFakeTimers();
    vi.mocked(api.saveDraft).mockRejectedValue(new Error('save failed'));

    const { result } = renderHook(() => usePageEditor(samplePage));

    act(() => result.current.handleChange(emptyData));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(result.current.status).toContain('save failed');
  });

  it('a pending debounced save does not fire after unmount', async () => {
    vi.useFakeTimers();
    vi.mocked(api.saveDraft).mockResolvedValue(samplePage);

    const { result, unmount } = renderHook(() => usePageEditor(samplePage));
    act(() => result.current.handleChange(emptyData));
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(api.saveDraft).not.toHaveBeenCalled();
  });

  it('handlePublish saves the draft then publishes', async () => {
    vi.mocked(api.saveDraft).mockResolvedValue(samplePage);
    vi.mocked(api.publishPage).mockResolvedValue(samplePage);

    const { result } = renderHook(() => usePageEditor(samplePage));

    await act(async () => {
      await result.current.handlePublish(emptyData);
    });

    expect(api.saveDraft).toHaveBeenCalledWith(samplePage.id, []);
    expect(api.publishPage).toHaveBeenCalledWith(samplePage.id);
    expect(result.current.status).toBe('Pubblicato');
  });
});
