import type {
  Block,
  FormField,
  OpeningHoursDay,
  SeoMeta,
  UntranslatedPageFallback,
} from '@brisk/shared-types';

/** Only what OG tags + schema.org rendering, and the language switcher (docs/adr/0017), need — mirrors PublishedSite in the API. */
export interface PublishedSiteDto {
  name: string;
  domain: string | null;
  defaultLocale: string;
  enabledLocales: string[];
  untranslatedPageFallback: UntranslatedPageFallback;
  businessAddress: string | null;
  businessPhone: string | null;
  businessType: string | null;
  openingHours: OpeningHoursDay[] | null;
  searchEngineIndexingEnabled: boolean;
}

/** One entry per published locale-translation of this page (docs/adr/0017), including itself. */
export interface PublishedPageTranslationDto {
  locale: string;
  slug: string;
}

/** Root-to-parent order (does not include the page itself). Empty for a root-level page. */
export interface PublishedPageAncestorDto {
  slug: string;
  title: string;
}

export interface PublishedPageDto {
  content: Block[];
  seoMeta: SeoMeta;
  locale: string;
  translations: PublishedPageTranslationDto[];
  ancestors: PublishedPageAncestorDto[];
  site: PublishedSiteDto;
  header: Block[] | null;
  footer: Block[] | null;
  headerSticky: boolean;
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
  locale: string,
  slug: string,
): Promise<PublishedPageDto | null> {
  const params = new URLSearchParams({ domain, locale, slug });
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

export interface PublishedSiteChromeDto {
  site: PublishedSiteDto;
  header: Block[] | null;
  footer: Block[] | null;
  headerSticky: boolean;
}

/**
 * Site-level header/footer with no specific page in the picture — for
 * routes with no backing Page row (e.g. search.astro), so they can still
 * render the site's normal chrome instead of a bare page. Same 404 ->
 * null collapse as getPublishedPageBySlug.
 */
export async function getPublishedSiteChrome(
  domain: string,
  locale: string,
): Promise<PublishedSiteChromeDto | null> {
  const params = new URLSearchParams({ domain, locale });
  const res = await fetch(
    `${apiUrl()}/public/pages/chrome?${params.toString()}`,
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
  locale: string;
  // Links locale-siblings together (docs/adr/0017) so sitemap.xml can group
  // entries into hreflang alternates instead of one flat <loc> per page.
  groupId: string;
  // Root-to-parent slugs (page hierarchy) — the canonical nested URL is
  // built from these, not the flat slug alone (see locale-path.ts).
  ancestorSlugs: string[];
  updatedAt: string;
}

export interface SitemapListingDto {
  items: SitemapEntryDto[];
  // Bundled with the page list rather than a separate lookup — both
  // sitemap.xml and robots.txt (docs/adr/0016) need "what does this
  // domain's site say about crawling", and both already need this same
  // site resolved by domain. An unmatched domain still resolves (never
  // 404s, see the API's own comment) with an empty, indexing-allowed
  // response, not an error.
  searchEngineIndexingEnabled: boolean;
  // The bare "/" route (docs/adr/0017) needs this to redirect to the
  // site's locale-prefixed home before it knows any slug at all.
  defaultLocale: string;
}

export async function listPublishedPagesForSitemap(
  domain: string,
): Promise<SitemapListingDto> {
  const params = new URLSearchParams({ domain });
  const res = await fetch(`${apiUrl()}/public/pages?${params.toString()}`);

  if (!res.ok) {
    throw new Error(`Public pages API error: ${res.status}`);
  }
  return res.json();
}

export interface SearchResultDto {
  pageId: string;
  slug: string;
  title: string;
  excerpt: string;
}

export async function searchPublishedPages(
  domain: string,
  locale: string,
  query: string,
): Promise<SearchResultDto[]> {
  const params = new URLSearchParams({ domain, locale, q: query });
  const res = await fetch(
    `${apiUrl()}/public/pages/search?${params.toString()}`,
  );

  if (!res.ok) {
    throw new Error(`Public pages API error: ${res.status}`);
  }
  const body = (await res.json()) as { items: SearchResultDto[] };
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

export interface UploadedFormAttachment {
  url: string;
  filename: string;
}

/**
 * Called server-side from the submit proxy (docs/adr/0015's pattern),
 * before the main JSON submission — a `file`-typed field's value has to
 * become `{ url, filename }` (form-fields.ts's own formFieldFileValueSchema)
 * ahead of that JSON POST, since a File object itself isn't JSON-
 * serializable. No CAPTCHA token needed here: the real API endpoint this
 * calls doesn't re-verify one (a Turnstile token is single-use, and the
 * main submission below already verifies it once for the whole
 * transaction — see public-forms.controller.ts's own comment on this).
 */
export async function uploadFormAttachment(
  formId: string,
  file: File,
): Promise<UploadedFormAttachment> {
  const body = new FormData();
  body.append('file', file, file.name);
  const res = await fetch(`${apiUrl()}/public/forms/${formId}/attachments`, {
    method: 'POST',
    body,
  });
  if (!res.ok) {
    throw new Error(`Public forms API error: ${res.status}`);
  }
  return res.json();
}

export interface SubmitPublicFormInput {
  pageId: string | null;
  values: Record<string, unknown>;
  honeypot: string;
  captchaToken: string;
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

export interface SubscribeNewsletterInput {
  email: string;
  honeypot: string;
  captchaToken: string;
}

export type SubscribeNewsletterResult =
  { ok: true } | { ok: false; status: number };

/** Called server-side from NewsletterSignup's same-origin proxy endpoint — same reasoning as submitPublicForm. */
export async function subscribeNewsletter(
  input: SubscribeNewsletterInput,
): Promise<SubscribeNewsletterResult> {
  const res = await fetch(`${apiUrl()}/public/newsletter/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (res.ok) {
    return { ok: true };
  }
  return { ok: false, status: res.status };
}
