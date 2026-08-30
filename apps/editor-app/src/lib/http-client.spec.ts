import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, request } from './http-client';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('http-client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves with the parsed JSON body on success', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ hello: 'world' }));

    const result = await request('/anything');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/anything'),
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
    expect(result).toEqual({ hello: 'world' });
  });

  it('throws an ApiError carrying the status and the parsed error body', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ message: 'Not found' }, false, 404),
    );

    await expect(request('/missing')).rejects.toThrow(/API 404.*Not found/);
    const error = await request('/missing').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
  });

  it('throws even when the error body cannot be parsed as JSON', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('not json')),
    } as unknown as Response);

    await expect(request('/broken')).rejects.toThrow(/API 500/);
  });

  it('resolves with undefined for a 204 No Content response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.reject(new Error('should not be called')),
    } as unknown as Response);

    await expect(request('/pages/page-1')).resolves.toBeUndefined();
  });

  it('does not set Content-Type: application/json for a FormData body', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}));
    const body = new FormData();
    body.append('file', new File(['data'], 'a.png'));

    await request('/media', { method: 'POST', body });

    const headers = vi.mocked(fetch).mock.calls[0][1]?.headers as Record<
      string,
      string
    >;
    expect(headers['Content-Type']).toBeUndefined();
  });

  it('passes an AbortSignal, so a hung backend eventually rejects instead of leaving the caller stuck forever', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}));

    await request('/anything');

    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  // Security review 2026-08-24, point 18: this is the exact failure mode
  // that motivated the fix — simulates what the browser produces when
  // AbortSignal.timeout() actually fires on a hung request.
  it('throws a clear timeout error instead of a raw AbortError when the request times out', async () => {
    vi.mocked(fetch).mockRejectedValue(
      new DOMException('The operation was aborted.', 'TimeoutError'),
    );

    await expect(request('/slow')).rejects.toThrow(/timed out/i);
  });

  it('lets a non-timeout fetch failure (e.g. offline) propagate unchanged', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(request('/anything')).rejects.toThrow('Failed to fetch');
  });
});
