import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getSite,
  updateBusinessInfo,
  type SiteDto,
} from './sites-api-client.js';

const sampleSite: SiteDto = {
  id: 'site-1',
  tenantId: 'tenant-1',
  name: 'Il mio sito',
  domain: 'example.com',
  defaultLocale: 'it',
  enabledLocales: ['it'],
  businessAddress: null,
  businessPhone: null,
  businessType: null,
  openingHours: null,
  createdAt: '',
};

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('sites-api-client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getSite fetches the site by id', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(sampleSite));

    const result = await getSite('site-1');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/sites/site-1'),
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(result).toEqual(sampleSite);
  });

  it('updateBusinessInfo patches the business-info endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(sampleSite));

    await updateBusinessInfo('site-1', {
      businessAddress: 'Via Roma 1',
      businessPhone: '+39 02 1234567',
      businessType: 'Restaurant',
      openingHours: [{ dayOfWeek: 'monday', ranges: [] }],
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/sites/site-1/business-info'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          businessAddress: 'Via Roma 1',
          businessPhone: '+39 02 1234567',
          businessType: 'Restaurant',
          openingHours: [{ dayOfWeek: 'monday', ranges: [] }],
        }),
      }),
    );
  });
});
