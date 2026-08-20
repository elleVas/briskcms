import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './submit.js';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

function formDataRequest(fields: Record<string, string>): Request {
  return new Request('http://localhost:4321/api/forms/form-1/submit', {
    method: 'POST',
    body: new URLSearchParams(fields),
  });
}

function redirect(path: string, status = 302): Response {
  return new Response(null, { status, headers: { Location: path } });
}

describe('POST /api/forms/[id]/submit', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards field values and redirects with formSubmitted on success', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(undefined, 204));

    const request = formDataRequest({
      _redirectTo: '/contatti',
      _checkboxFields: 'consenso',
      _honeypot: '',
      email: 'visitor@example.com',
      consenso: 'on',
    });

    // @ts-expect-error deliberately partial APIContext — only params/request/redirect are used by this route.
    const res = await POST({ params: { id: 'form-1' }, request, redirect });

    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe('/contatti?formSubmitted=form-1');

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(init?.body as string)).toEqual({
      pageId: null,
      values: { email: 'visitor@example.com', consenso: true },
      honeypot: '',
      captchaToken: '',
    });
  });

  it("forwards Turnstile's injected cf-turnstile-response as the captcha token", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(undefined, 204));

    const request = formDataRequest({
      _redirectTo: '/contatti',
      _checkboxFields: '',
      _honeypot: '',
      email: 'visitor@example.com',
      'cf-turnstile-response': 'widget-token',
    });

    // @ts-expect-error deliberately partial APIContext
    await POST({ params: { id: 'form-1' }, request, redirect });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(init?.body as string);
    expect(body.captchaToken).toBe('widget-token');
    // Must not leak into the form's own field values.
    expect(body.values).not.toHaveProperty('cf-turnstile-response');
  });

  it('marks an unchecked checkbox as false even though the browser never submits its key', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(undefined, 204));

    const request = formDataRequest({
      _redirectTo: '/contatti',
      _checkboxFields: 'consenso',
      _honeypot: '',
      email: 'visitor@example.com',
      // consenso deliberately absent — a native unchecked checkbox never submits a key.
    });

    // @ts-expect-error deliberately partial APIContext
    await POST({ params: { id: 'form-1' }, request, redirect });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(init?.body as string).values.consenso).toBe(false);
  });

  it('redirects with formError when the API rejects the submission', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ message: 'Missing required field' }, 400),
    );

    const request = formDataRequest({
      _redirectTo: '/contatti',
      _checkboxFields: '',
      _honeypot: '',
    });

    // @ts-expect-error deliberately partial APIContext
    const res = await POST({ params: { id: 'form-1' }, request, redirect });

    expect(res.headers.get('Location')).toBe('/contatti?formError=form-1');
  });

  it('404s when the id param is missing', async () => {
    const request = formDataRequest({});

    // @ts-expect-error deliberately partial APIContext
    const res = await POST({ params: {}, request, redirect });

    expect(res.status).toBe(404);
  });
});
