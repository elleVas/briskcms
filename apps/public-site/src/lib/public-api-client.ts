import type { Block, OpeningHoursDay, SeoMeta } from '@brisk/shared-types';

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

export interface SitemapEntryDto {
  slug: string;
  updatedAt: string;
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

export async function listPublishedPagesForSitemap(
  domain: string,
): Promise<SitemapEntryDto[]> {
  const params = new URLSearchParams({ domain });
  const res = await fetch(`${apiUrl()}/public/pages?${params.toString()}`);

  if (!res.ok) {
    throw new Error(`Public pages API error: ${res.status}`);
  }
  const body = (await res.json()) as { items: SitemapEntryDto[] };
  return body.items;
}
