import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPage,
  getPage,
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

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
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
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
    expect(result).toEqual(samplePage);
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

  it('throws with the parsed error body when the response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ message: 'Not found' }, false, 404),
    );

    await expect(getPage('missing')).rejects.toThrow(/API 404.*Not found/);
  });

  it('throws even when the error body cannot be parsed as JSON', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('not json')),
    } as unknown as Response);

    await expect(getPage('page-1')).rejects.toThrow(/API 500/);
  });
});
