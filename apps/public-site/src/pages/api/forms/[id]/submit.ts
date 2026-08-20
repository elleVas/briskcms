import type { APIRoute } from 'astro';
import { submitPublicForm } from '../../../../lib/public-api-client.js';

// Same-origin proxy (docs/adr/0015): the browser only ever POSTs to this
// app's own origin, never directly to the API — avoids touching ADR-0010's
// session-cookie-driven CORS config for an unauthenticated, uncredentialed
// write path that has nothing to do with editor-app's origin. Dynamic (not
// known at build time), same reasoning as [slug].astro.
export const prerender = false;

export const POST: APIRoute = async ({ params, request, redirect }) => {
  const formId = params.id;
  if (!formId) {
    return new Response('Not found', { status: 404 });
  }

  const formData = await request.formData();
  const honeypot = String(formData.get('_honeypot') ?? '');
  // Turnstile's widget script injects this hidden input itself once the
  // visitor completes the check — no extra glue needed on our side to wire
  // it into the form's own POST body.
  const captchaToken = String(formData.get('cf-turnstile-response') ?? '');
  const redirectTo = String(formData.get('_redirectTo') ?? '/');
  // Native unchecked checkboxes never submit a key at all — the hint tells
  // this proxy which field ids to treat as booleans (present === true,
  // absent === false) instead of leaving them out of `values` entirely,
  // without re-fetching the form's field definitions a third time.
  const checkboxFieldIds = String(formData.get('_checkboxFields') ?? '')
    .split(',')
    .filter(Boolean);

  const values: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('_') || key === 'cf-turnstile-response') continue;
    values[key] = checkboxFieldIds.includes(key) ? value === 'on' : value;
  }
  for (const id of checkboxFieldIds) {
    if (!(id in values)) values[id] = false;
  }

  // The public site doesn't track a page's own id yet (see
  // public-api-client.ts's PublishedPageDto) — nullable by design for
  // exactly this case, not a workaround.
  const result = await submitPublicForm(formId, {
    pageId: null,
    values,
    honeypot,
    captchaToken,
  });

  const redirectUrl = new URL(redirectTo, request.url);
  redirectUrl.searchParams.set(
    result.ok ? 'formSubmitted' : 'formError',
    formId,
  );
  // 303: turns the POST into a GET on redirect, so refreshing the result
  // page never resubmits the form.
  return redirect(redirectUrl.pathname + redirectUrl.search, 303);
};
