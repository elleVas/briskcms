import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { Block } from '@brisk/shared-types';
import * as api from '../lib/site-layout-sections-api-client';
import { createTestQueryClient } from '../test-query-client';
import { siteLayoutSectionQueryOptions } from './site-layout-sections-queries';
import { useSiteLayoutSectionEditor } from './use-site-layout-section-editor';

vi.mock('../lib/site-layout-sections-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../lib/site-layout-sections-api-client')
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

const sampleContent: Block[] = [{ id: 'nav-1', type: 'Nav', props: {} }];

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
    vi.clearAllMocks();
  });

  it('starts with the cached section and idle status', () => {
    const { result } = renderEditor();

    expect(result.current.section).toEqual(sampleSection);
    expect(result.current.status).toEqual({ kind: 'idle' });
  });

  it('handleChange saves the draft immediately — no debounce, canvas-editor-shell already debounces', async () => {
    vi.mocked(api.saveDraft).mockResolvedValue(sampleSection);

    const { result } = renderEditor();

    await act(async () => {
      result.current.handleChange(sampleContent);
    });

    expect(api.saveDraft).toHaveBeenCalledWith(sampleSection.id, sampleContent);
    expect(result.current.status).toEqual({ kind: 'saved' });
  });

  it('handleChange sets an error status when the save fails', async () => {
    vi.mocked(api.saveDraft).mockRejectedValue(new Error('save failed'));

    const { result } = renderEditor();

    await act(async () => {
      result.current.handleChange(sampleContent);
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
      await result.current.handlePublish(sampleContent);
    });

    expect(api.saveDraft).toHaveBeenCalledWith(sampleSection.id, sampleContent);
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
