import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchBlockStyleDefaults,
  fetchThemeIcons,
} from './theme-api-client.js';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('theme-api-client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetchThemeIcons fetches and parses the icon manifest', async () => {
    const icons = [{ name: 'star', svg: '<svg></svg>' }];
    vi.mocked(fetch).mockResolvedValue(jsonResponse(icons));

    const result = await fetchThemeIcons();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/themes/current/icons'),
    );
    expect(result).toEqual(icons);
  });

  it('fetchThemeIcons throws on a non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, false, 500));

    await expect(fetchThemeIcons()).rejects.toThrow(
      /themes\/current\/icons API error: 500/,
    );
  });

  it('fetchBlockStyleDefaults fetches and parses the defaults map', async () => {
    const defaults = { Button: { backgroundColor: 'var(--primary)' } };
    vi.mocked(fetch).mockResolvedValue(jsonResponse(defaults));

    const result = await fetchBlockStyleDefaults();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/themes/current/block-style-defaults'),
    );
    expect(result).toEqual(defaults);
  });

  it('fetchBlockStyleDefaults throws on a non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, false, 404));

    await expect(fetchBlockStyleDefaults()).rejects.toThrow(
      /themes\/current\/block-style-defaults API error: 404/,
    );
  });
});
