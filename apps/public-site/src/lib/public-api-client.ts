import type { PageTreeNodeDto } from '@brisk/theme-runtime';
import { requireEnv } from '@brisk/env-config';
import {
  publishedPageSchema,
  publishedSiteSchema,
  publishedTermSchema,
  type Block,
  type FormField,
  type FormStep,
  type PublishedPage,
  type PublishedSite,
  type PublishedTerm,
} from '@brisk/shared-types';

/** Where to send the visitor when (locale, path) has no published page — see resolveUntranslatedPageFallback on the application side. */
export interface UntranslatedPageFallbackTargetDto {
  locale: string;
  /** The same segmented path as the input, under `locale` — see resolvePageByPath. */
  segments: string[];
}

export type PublishedPageLookupResult =
  | { found: true; page: PublishedPage }
  | {
      found: false;
      fallback: UntranslatedPageFallbackTargetDto | null;
      /**
       * The address this content lives at now — a term claimed it as its
       * landing page (docs/adr/0067). Distinct from `fallback`, which is
       * a courtesy for a language that has no such page at all: this one
       * is a permanent move, and the route answers it with a 301 rather
       * than a 302.
       */
      movedTo: string | null;
    };

// process.env, not import.meta.env: this must read the real deployment's
// value at request time (Node adapter, SSR), not whatever was baked in at
// build time — one built image serves whichever domains its env points at.
function apiUrl(): string {
  return requireEnv('API_URL');
}

// Security review 2026-08-24, point 18: without this, a hung apps/api
// (pool exhausted, a slow query) blocked the Node worker rendering this
// request indefinitely — in SSR (astro.config.mjs's output:'server') that
// worker serves other visitors too, not just this one request.
const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * Not exported — an injected collaborator private to this module, not a
 * general-purpose "fetch helper". Every one of the 10 functions below owns
 * its own response interpretation (404-collapses-to-null, `{ ok, status }`
 * discriminated results, differing error message prefixes); this class
 * owns only the one thing they genuinely share: applying the timeout and
 * turning `AbortSignal.timeout()`'s `DOMException` into a readable error.
 */
class TimedFetcher {
  async fetch(url: string, init?: RequestInit): Promise<Response> {
    try {
      return await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new Error(`Public API request timed out: ${url}`);
      }
      throw error;
    }
  }
}

const timedFetcher = new TimedFetcher();

/**
 * Talks to the public, unauthenticated endpoint only (see
 * apps/api/src/app/public-pages) — never the authenticated CRUD one
 * editor-app uses. A 404 here means "nothing to show at this exact
 * (locale, slug)" (no page, or a page that's still a draft — the API
 * deliberately doesn't distinguish the two, see that module's own
 * comments), not an error — `found: false` still carries an optional
 * `fallback` (a sibling page in the site's default locale, only when the
 * site is configured for it) that the caller decides whether to redirect
 * to. See resolveUntranslatedPageFallback in @brisk/application.
 */
export async function getPublishedPageBySlug(
  domain: string,
  locale: string,
  segments: string[],
): Promise<PublishedPageLookupResult> {
  const params = new URLSearchParams({
    domain,
    locale,
    path: segments.join('/'),
  });
  const res = await timedFetcher.fetch(
    `${apiUrl()}/public/pages/by-slug?${params.toString()}`,
  );

  if (res.status === 404) {
    const body: unknown = await res.json().catch(() => null);
    const parsed =
      body && typeof body === 'object'
        ? (body as {
            fallback?: UntranslatedPageFallbackTargetDto | null;
            movedTo?: string | null;
          })
        : {};
    return {
      found: false,
      fallback: parsed.fallback ?? null,
      movedTo: parsed.movedTo ?? null,
    };
  }
  if (!res.ok) {
    throw new Error(`Public pages API error: ${res.status}`);
  }
  return { found: true, page: publishedPageSchema.parse(await res.json()) };
}

/**
 * A term's own page (docs/adr/0064), asked for ONLY after the page
 * lookup came back empty — a page always wins, and doing the two in that
 * order is what makes that true at render time rather than only at write
 * time.
 *
 * `null` for anything that is not a term: no term at that address, a
 * path too deep to be one, an unknown domain. The route then 404s
 * exactly as it did before terms existed.
 */
export async function getPublishedTermByPath(
  domain: string,
  locale: string,
  segments: string[],
): Promise<PublishedTerm | null> {
  const params = new URLSearchParams({
    domain,
    locale,
    path: segments.join('/'),
  });
  const res = await timedFetcher.fetch(
    `${apiUrl()}/public/pages/term-by-path?${params.toString()}`,
  );

  if (res.status === 404 || res.status === 400) {
    // 400 is a path this endpoint refuses to even look up — three
    // segments, say. For the caller that is the same answer as "no term
    // here", and it is the page route's 404 that the visitor sees.
    return null;
  }
  if (!res.ok) {
    throw new Error(`Public terms API error: ${res.status}`);
  }
  return publishedTermSchema.parse(await res.json());
}

/**
 * The draft-editing, unauthenticated read path (see the visual editor plan,
 * Day 1) — used only by the preview route
 * (src/pages/preview/[pageId].astro), never by the real public route. The
 * same 404 -> null collapse as getPublishedPageBySlug: a missing, expired
 * or mismatched token is indistinguishable from a page that does not exist.
 */
export async function getPreviewPageById(
  pageId: string,
  token: string,
): Promise<PublishedPage | null> {
  const params = new URLSearchParams({ token });
  const res = await timedFetcher.fetch(
    `${apiUrl()}/public/pages/${pageId}/preview?${params.toString()}`,
  );

  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Public pages API error: ${res.status}`);
  }
  return publishedPageSchema.parse(await res.json());
}

/**
 * The reusable section behind a preview token, shaped as a page so the
 * section editor's canvas can render it with the same components
 * (docs/adr/0059). Same 404 -> null collapse as everything else here.
 */
export async function getPreviewSectionById(
  sectionId: string,
  token: string,
  locale: string,
): Promise<PublishedPage | null> {
  const params = new URLSearchParams({ token, locale });
  const res = await timedFetcher.fetch(
    `${apiUrl()}/public/pages/sections/${sectionId}/preview?${params.toString()}`,
  );

  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Public pages API error: ${res.status}`);
  }
  return publishedPageSchema.parse(await res.json());
}

export interface PublishedSiteChromeDto {
  site: PublishedSite;
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
  const res = await timedFetcher.fetch(
    `${apiUrl()}/public/pages/chrome?${params.toString()}`,
  );

  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Public pages API error: ${res.status}`);
  }
  const chrome: PublishedSiteChromeDto = await res.json();
  return { ...chrome, site: publishedSiteSchema.parse(chrome.site) };
}

// Built for a theme's own sidebar/tree navigation (docs-showcase,
// docs/adr/0021's per-block override escalation) — flat list, not nested;
// the caller (a theme's PageLayout.astro override) groups it into whatever
// shape its own sidebar needs.
export async function listPublishedPageTree(
  domain: string,
  locale: string,
): Promise<PageTreeNodeDto[]> {
  const params = new URLSearchParams({ domain, locale });
  const res = await timedFetcher.fetch(
    `${apiUrl()}/public/pages/tree?${params.toString()}`,
  );

  if (!res.ok) {
    throw new Error(`Public pages API error: ${res.status}`);
  }
  const body: { items: PageTreeNodeDto[] } = await res.json();
  return body.items;
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
  const res = await timedFetcher.fetch(
    `${apiUrl()}/public/pages?${params.toString()}`,
  );

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
  const res = await timedFetcher.fetch(
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
  steps: FormStep[];
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
  const res = await timedFetcher.fetch(`${apiUrl()}/public/forms/${formId}`);
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
  const res = await timedFetcher.fetch(
    `${apiUrl()}/public/forms/${formId}/attachments`,
    { method: 'POST', body },
  );
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
  const res = await timedFetcher.fetch(
    `${apiUrl()}/public/forms/${formId}/submissions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
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
  const res = await timedFetcher.fetch(
    `${apiUrl()}/public/newsletter/subscribe`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  if (res.ok) {
    return { ok: true };
  }
  return { ok: false, status: res.status };
}

/**
 * Whether this deployment has been through its first-run wizard. Only the
 * 500 page asks: it is where every failing route ends up, and "nobody has
 * set this up yet" is the one failure there with a remedy worth naming
 * instead of a generic apology.
 *
 * Resolves to `true` when the API cannot be reached at all — a backend
 * that is down is a different problem, and claiming the site is
 * unconfigured would send the reader off to fix the wrong thing.
 */
export async function hasDeploymentBeenSetUp(): Promise<boolean> {
  try {
    const res = await fetch(`${apiUrl()}/setup/status`, {
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    if (!res.ok) return true;
    const body: { hasBeenSetUp: boolean } = await res.json();
    return body.hasBeenSetUp;
  } catch {
    return true;
  }
}
