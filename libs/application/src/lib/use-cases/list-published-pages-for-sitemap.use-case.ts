import type { PageRepositoryPort, SiteRepositoryPort } from '@brisk/ports';

export interface SitemapEntry {
  slug: string;
  updatedAt: Date;
}

export interface ListPublishedPagesForSitemapDeps {
  siteRepository: SiteRepositoryPort;
  pageRepository: PageRepositoryPort;
}

export interface ListPublishedPagesForSitemapInput {
  tenantId: string;
  domain: string;
}

// Same "5-15 pagine, siti vetrina" scale assumption as everywhere else in
// the product (piano-progetto-astro-cms.md) — one page of results is
// always enough, no real pagination needed for a sitemap at this scale.
const SITEMAP_PAGE_SIZE = 1000;

/**
 * Public, unauthenticated — same domain-resolution pattern as
 * getPublishedPageBySlug (never trusts a client-supplied siteId). Returns
 * null when the domain matches no site at all, same as that use case; the
 * controller renders that as an empty sitemap rather than an error, since
 * a misconfigured domain producing a broken sitemap.xml is worse for SEO
 * than a technically-empty-but-valid one.
 */
export async function listPublishedPagesForSitemap(
  deps: ListPublishedPagesForSitemapDeps,
  input: ListPublishedPagesForSitemapInput,
): Promise<SitemapEntry[] | null> {
  const site = await deps.siteRepository.findByDomain(
    input.tenantId,
    input.domain,
  );
  if (!site) {
    return null;
  }

  const { items } = await deps.pageRepository.listBySite(
    input.tenantId,
    site.id,
    { page: 1, pageSize: SITEMAP_PAGE_SIZE },
  );

  return items
    .filter((page) => page.status === 'published')
    .map((page) => ({ slug: page.slug, updatedAt: page.updatedAt }));
}
