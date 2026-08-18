import type {
  Block,
  FormField,
  OpeningHoursDay,
  SeoMeta,
} from '@brisk/shared-types';

/** Only what OG tags + schema.org rendering needs (docs/adr/0014), mirrors PublishedSite in the API. */
export interface PublishedSiteDto {
  name: string;
  domain: string | null;
  businessAddress: string | null;
  businessPhone: string | null;
  businessType: string | null;
  openingHours: OpeningHoursDay[] | null;
}

export interface PublishedPageDto {
  content: Block[];
  seoMeta: SeoMeta;
  locale: string;
  site: PublishedSiteDto;
}

// process.env, not import.meta.env: this must read the real deployment's
// value at request time (Node adapter, SSR), not whatever was baked in at
// build time — one built image serves whichever domains its env points at.
function apiUrl(): string {
  return process.env['API_URL'] ?? 'http://localhost:3000/api';
}

/**
 * Talks to the public, unauthenticated endpoint only (see
 * apps/api/src/app/public-pages) — never the authenticated CRUD one
 * editor-app uses. A 404 here means "nothing to show" (no page, or a page
 * that's still a draft — the API deliberately doesn't distinguish the two,
 * see that module's own comments), not an error.
 */
export async function getPublishedPageBySlug(
  domain: string,
  slug: string,
): Promise<PublishedPageDto | null> {
  const params = new URLSearchParams({ domain, slug });
  const res = await fetch(
    `${apiUrl()}/public/pages/by-slug?${params.toString()}`,
  );

  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Public pages API error: ${res.status}`);
  }
  return res.json();
}

export interface SitemapEntryDto {
  slug: string;
  updatedAt: string;
}

/** Same "nothing to show" 404 handling as getPublishedPageBySlug — an unmatched domain returns null, not a thrown error. */
export async function listPublishedPages(
  domain: string,
): Promise<SitemapEntryDto[] | null> {
  const params = new URLSearchParams({ domain });
  const res = await fetch(`${apiUrl()}/public/pages?${params.toString()}`);

  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Public pages API error: ${res.status}`);
  }
  const body = (await res.json()) as { items: SitemapEntryDto[] };
  return body.items;
}

export interface PublicFormDto {
  id: string;
  name: string;
  fields: FormField[];
}

/**
 * Called on every render of a Form block (docs/adr/0015 — live-fetched,
 * never snapshotted), so a form's field definitions edited in the admin
 * panel show up on already-published pages without republishing them.
 * A 404 means the form was deleted after the page picked it — same
 * "nothing to show" handling as a missing page, not an error.
 */
export async function getPublicForm(
  formId: string,
): Promise<PublicFormDto | null> {
  const res = await fetch(`${apiUrl()}/public/forms/${formId}`);
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Public forms API error: ${res.status}`);
  }
  return res.json();
}

export interface SubmitPublicFormInput {
  pageId: string | null;
  values: Record<string, unknown>;
  honeypot: string;
}

export type SubmitPublicFormResult =
  { ok: true } | { ok: false; status: number };

/** Called server-side from the same-origin proxy endpoint (docs/adr/0015), never directly from the browser. */
export async function submitPublicForm(
  formId: string,
  input: SubmitPublicFormInput,
): Promise<SubmitPublicFormResult> {
  const res = await fetch(`${apiUrl()}/public/forms/${formId}/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (res.ok) {
    return { ok: true };
  }
  return { ok: false, status: res.status };
}
