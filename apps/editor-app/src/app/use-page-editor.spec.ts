import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Data } from '@puckeditor/core';
import * as api from '../lib/pages-api-client.js';
import { usePageEditor } from './use-page-editor.js';

// A bare automock stubs out ApiError's constructor body too (it would
// silently drop the `status` field the 401 check below depends on) — keep
// the real class, mock only the network-calling functions.
vi.mock('../lib/pages-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/pages-api-client.js')>();
  return {
    ...actual,
    createPage: vi.fn(),
    getPage: vi.fn(),
    saveDraft: vi.fn(),
    publishPage: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
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

function setSearch(search: string) {
  window.history.pushState({}, '', search);
}

describe('usePageEditor', () => {
  beforeEach(() => {
    setSearch('/');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('starts in a loading state and creates a page when the URL has no pageId', async () => {
    vi.mocked(api.createPage).mockResolvedValue(samplePage);

    const { result } = renderHook(() => usePageEditor());

    expect(result.current.status).toBe('Caricamento...');
    expect(result.current.page).toBeNull();

    await waitFor(() => expect(result.current.page).toEqual(samplePage));
    expect(result.current.status).toBe('');
    expect(api.createPage).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: expect.any(String) }),
    );
  });

  it('sets an error status when creating the initial page fails', async () => {
    vi.mocked(api.createPage).mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => usePageEditor());

    await waitFor(() => expect(result.current.status).toContain('boom'));
    expect(result.current.page).toBeNull();
  });

  it('sets needsLogin when the initial load is rejected with a 401', async () => {
    vi.mocked(api.createPage).mockRejectedValue(
      new api.ApiError(401, { message: 'Unauthorized' }),
    );

    const { result } = renderHook(() => usePageEditor());

    await waitFor(() => expect(result.current.needsLogin).toBe(true));
    expect(result.current.status).toBe('');
    expect(result.current.page).toBeNull();
  });

  it('handleLogin logs in and reloads the page', async () => {
    vi.mocked(api.createPage).mockRejectedValueOnce(
      new api.ApiError(401, { message: 'Unauthorized' }),
    );
    vi.mocked(api.login).mockResolvedValue({ userId: 'user-1' });

    const { result } = renderHook(() => usePageEditor());
    await waitFor(() => expect(result.current.needsLogin).toBe(true));

    vi.mocked(api.createPage).mockResolvedValue(samplePage);
    await act(async () => {
      await result.current.handleLogin('lele@example.com', 'correct');
    });

    expect(api.login).toHaveBeenCalledWith('lele@example.com', 'correct');
    expect(result.current.needsLogin).toBe(false);
    expect(result.current.page).toEqual(samplePage);
  });

  it('handleLogin propagates the error when login itself fails', async () => {
    vi.mocked(api.createPage).mockResolvedValue(samplePage);
    vi.mocked(api.login).mockRejectedValue(
      new api.ApiError(401, { message: 'Invalid credentials' }),
    );

    const { result } = renderHook(() => usePageEditor());
    await waitFor(() => expect(result.current.page).toEqual(samplePage));

    await expect(
      result.current.handleLogin('lele@example.com', 'wrong'),
    ).rejects.toThrow();
  });

  it('handleLogout logs out and returns to the login screen', async () => {
    vi.mocked(api.createPage).mockResolvedValue(samplePage);
    vi.mocked(api.logout).mockResolvedValue({ success: true });

    const { result } = renderHook(() => usePageEditor());
    await waitFor(() => expect(result.current.page).toEqual(samplePage));

    await act(async () => {
      await result.current.handleLogout();
    });

    expect(api.logout).toHaveBeenCalled();
    expect(result.current.needsLogin).toBe(true);
    expect(result.current.page).toBeNull();
  });

  it('handleLogout still returns to the login screen even if the server call fails', async () => {
    vi.mocked(api.createPage).mockResolvedValue(samplePage);
    vi.mocked(api.logout).mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => usePageEditor());
    await waitFor(() => expect(result.current.page).toEqual(samplePage));

    await act(async () => {
      await result.current.handleLogout();
    });

    expect(result.current.needsLogin).toBe(true);
    expect(result.current.page).toBeNull();
  });

  it('loads the existing page when the URL has a pageId', async () => {
    setSearch('?pageId=page-1');
    vi.mocked(api.getPage).mockResolvedValue(samplePage);

    const { result } = renderHook(() => usePageEditor());

    await waitFor(() => expect(result.current.page).toEqual(samplePage));
    expect(api.getPage).toHaveBeenCalledWith('page-1');
    expect(api.createPage).not.toHaveBeenCalled();
  });

  it('sets an error status when loading the existing page fails', async () => {
    setSearch('?pageId=page-1');
    vi.mocked(api.getPage).mockRejectedValue(new Error('not found'));

    const { result } = renderHook(() => usePageEditor());

    await waitFor(() => expect(result.current.status).toContain('not found'));
  });

  it('handleChange does nothing before a page has loaded', () => {
    vi.mocked(api.createPage).mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => usePageEditor());
    act(() => result.current.handleChange(emptyData));

    expect(api.saveDraft).not.toHaveBeenCalled();
  });

  it('handleChange debounces and saves the draft', async () => {
    vi.useFakeTimers();
    vi.mocked(api.createPage).mockResolvedValue(samplePage);
    vi.mocked(api.saveDraft).mockResolvedValue(samplePage);

    const { result } = renderHook(() => usePageEditor());
    await vi.waitFor(() => expect(result.current.page).toEqual(samplePage));

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
    vi.mocked(api.createPage).mockResolvedValue(samplePage);
    vi.mocked(api.saveDraft).mockRejectedValue(new Error('save failed'));

    const { result } = renderHook(() => usePageEditor());
    await vi.waitFor(() => expect(result.current.page).toEqual(samplePage));

    act(() => result.current.handleChange(emptyData));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(result.current.status).toContain('save failed');
  });

  it('handlePublish does nothing before a page has loaded', async () => {
    vi.mocked(api.createPage).mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => usePageEditor());
    await act(async () => {
      await result.current.handlePublish(emptyData);
    });

    expect(api.saveDraft).not.toHaveBeenCalled();
    expect(api.publishPage).not.toHaveBeenCalled();
  });

  it('handlePublish saves the draft then publishes', async () => {
    vi.mocked(api.createPage).mockResolvedValue(samplePage);
    vi.mocked(api.saveDraft).mockResolvedValue(samplePage);
    vi.mocked(api.publishPage).mockResolvedValue(samplePage);

    const { result } = renderHook(() => usePageEditor());
    await waitFor(() => expect(result.current.page).toEqual(samplePage));

    await act(async () => {
      await result.current.handlePublish(emptyData);
    });

    expect(api.saveDraft).toHaveBeenCalledWith(samplePage.id, []);
    expect(api.publishPage).toHaveBeenCalledWith(samplePage.id);
    expect(result.current.status).toBe('Pubblicato');
  });
});
