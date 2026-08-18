import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as router from '@tanstack/react-router';
import * as api from '../lib/pages-api-client.js';
import { usePagesList } from './use-pages-list.js';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return { ...actual, useNavigate: vi.fn() };
});

vi.mock('../lib/pages-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/pages-api-client.js')>();
  return { ...actual, createPage: vi.fn() };
});

const samplePage: api.PageDto = {
  id: 'page-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  groupId: 'group-1',
  locale: 'it',
  slug: 'pagina-1',
  status: 'draft',
  content: [],
  publishedContent: null,
  seoMeta: { title: 'Nuova pagina', description: '' },
  createdAt: '',
  updatedAt: '',
};

describe('usePagesList', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('createPage posts a new page for the given site and navigates to its editor', async () => {
    const navigate = vi.fn();
    vi.mocked(router.useNavigate).mockReturnValue(navigate);
    vi.mocked(api.createPage).mockResolvedValue(samplePage);

    const { result } = renderHook(() => usePagesList('site-1'));

    await act(async () => {
      await result.current.createPage();
    });

    expect(api.createPage).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: 'site-1' }),
    );
    expect(navigate).toHaveBeenCalledWith({
      to: '/pages/$pageId',
      params: { pageId: samplePage.id },
    });
  });
});
