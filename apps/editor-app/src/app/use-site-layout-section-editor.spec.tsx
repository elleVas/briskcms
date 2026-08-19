import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { Data } from '@puckeditor/core';
import * as api from '../lib/site-layout-sections-api-client.js';
import { createTestQueryClient } from '../test-query-client.js';
import { siteLayoutSectionQueryOptions } from './site-layout-sections-queries.js';
import { useSiteLayoutSectionEditor } from './use-site-layout-section-editor.js';

vi.mock('../lib/site-layout-sections-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../lib/site-layout-sections-api-client.js')
    >();
  return {
    ...actual,
    saveDraft: vi.fn(),
    publishSiteLayoutSection: vi.fn(),
    updateSticky: vi.fn(),
  };
});

const sampleSection: api.SiteLayoutSectionDto = {
  id: 'section-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  locale: 'it',
  kind: 'header',
  status: 'draft',
  content: [],
  publishedContent: null,
  sticky: false,
  createdAt: '',
  updatedAt: '',
};

const emptyData: Data = { root: {}, content: [], zones: {} };

// Pre-seeds the query cache so useSuspenseQuery resolves synchronously —
// same reasoning as usePageEditor's own tests.
function renderEditor() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(
    siteLayoutSectionQueryOptions('site-1', 'it', 'header').queryKey,
    sampleSection,
  );
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return renderHook(
    () => useSiteLayoutSectionEditor('site-1', 'it', 'header'),
    { wrapper },
  );
}

describe('useSiteLayoutSectionEditor', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('starts with the cached section and idle status', () => {
    const { result } = renderEditor();

    expect(result.current.section).toEqual(sampleSection);
    expect(result.current.status).toEqual({ kind: 'idle' });
  });

  it('handleChange debounces and saves the draft', async () => {
    vi.useFakeTimers();
    vi.mocked(api.saveDraft).mockResolvedValue(sampleSection);

    const { result } = renderEditor();

    act(() => result.current.handleChange(emptyData));
    expect(api.saveDraft).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(api.saveDraft).toHaveBeenCalledWith(sampleSection.id, []);
    expect(result.current.status).toEqual({ kind: 'saved' });
  });

  it('handleChange sets an error status when the debounced save fails', async () => {
    vi.useFakeTimers();
    vi.mocked(api.saveDraft).mockRejectedValue(new Error('save failed'));

    const { result } = renderEditor();

    act(() => result.current.handleChange(emptyData));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(result.current.status).toEqual({
      kind: 'error',
      message: expect.stringContaining('save failed'),
    });
  });

  it('handlePublish saves the draft then publishes', async () => {
    vi.mocked(api.saveDraft).mockResolvedValue(sampleSection);
    vi.mocked(api.publishSiteLayoutSection).mockResolvedValue({
      ...sampleSection,
      status: 'published',
    });

    const { result } = renderEditor();

    await act(async () => {
      await result.current.handlePublish(emptyData);
    });

    expect(api.saveDraft).toHaveBeenCalledWith(sampleSection.id, []);
    expect(api.publishSiteLayoutSection).toHaveBeenCalledWith(sampleSection.id);
    expect(result.current.status).toEqual({ kind: 'published' });
  });

  it('handleStickyChange calls updateSticky and refreshes the cached section', async () => {
    vi.mocked(api.updateSticky).mockResolvedValue({
      ...sampleSection,
      sticky: true,
    });

    const { result } = renderEditor();

    await act(async () => {
      result.current.handleStickyChange(true);
    });

    expect(api.updateSticky).toHaveBeenCalledWith(sampleSection.id, true);
  });

  it('handleStickyChange sets an error status when the update fails', async () => {
    vi.mocked(api.updateSticky).mockRejectedValue(new Error('sticky failed'));

    const { result } = renderEditor();

    await act(async () => {
      result.current.handleStickyChange(true);
    });

    expect(result.current.status).toEqual({
      kind: 'error',
      message: expect.stringContaining('sticky failed'),
    });
  });
});
