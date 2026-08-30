import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPagePreviewToken,
  createSiteLayoutSectionPreviewToken,
} from './preview-token-api-client';

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 201,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('preview-token-api-client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('createPagePreviewToken POSTs to the page-scoped route', async () => {
    const token = { token: 'tok123', expiresAt: '2026-01-01T00:00:00.000Z' };
    vi.mocked(fetch).mockResolvedValue(jsonResponse(token));

    const result = await createPagePreviewToken('page-1');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/pages/page-1/preview-token'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(result).toEqual(token);
  });

  it('createSiteLayoutSectionPreviewToken POSTs to the section-scoped route', async () => {
    const token = { token: 'tok456', expiresAt: '2026-01-01T00:00:00.000Z' };
    vi.mocked(fetch).mockResolvedValue(jsonResponse(token));

    const result = await createSiteLayoutSectionPreviewToken('section-1');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/site-layout-sections/section-1/preview-token'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(result).toEqual(token);
  });
});
