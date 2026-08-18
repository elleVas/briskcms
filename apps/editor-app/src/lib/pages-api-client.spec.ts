import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPage,
  deletePage,
  getPage,
  listPages,
  publishPage,
  saveDraft,
  type PageDto,
} from './pages-api-client.js';

const samplePage: PageDto = {
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

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('pages-api-client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getPage fetches the page by id', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(samplePage));

    const result = await getPage('page-1');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/pages/page-1'),
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
    expect(result).toEqual(samplePage);
  });

  it('listPages fetches the pages for a site', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([samplePage]));

    const result = await listPages('site-1');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/pages?siteId=site-1'),
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(result).toEqual([samplePage]);
  });

  it('createPage posts the input and returns the created page', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(samplePage));

    const result = await createPage({
      siteId: 'site-1',
      groupId: 'group-1',
      locale: 'it',
      slug: 'new-page',
      seoMeta: { title: 'New', description: '' },
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/pages'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result).toEqual(samplePage);
  });

  it('saveDraft patches the content', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(samplePage));

    await saveDraft('page-1', [{ type: 'Text', props: { body: 'hi' } }]);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/pages/page-1/draft'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          content: [{ type: 'Text', props: { body: 'hi' } }],
        }),
      }),
    );
  });

  it('publishPage posts to the publish endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(samplePage));

    await publishPage('page-1');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/pages/page-1/publish'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('deletePage sends a DELETE to the page endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.reject(new Error('should not be called')),
    } as unknown as Response);

    await deletePage('page-1');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/pages/page-1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
