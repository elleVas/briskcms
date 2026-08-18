import type { PageRepositoryPort, SiteRepositoryPort } from '@brisk/ports';

export interface ListPublishedPagesForSitemapDeps {
  siteRepository: SiteRepositoryPort;
  pageRepository: PageRepositoryPort;
}

export interface ListPublishedPagesForSitemapInput {
  tenantId: string;
  domain: string;
}

export interface SitemapEntry {
  slug: string;
  updatedAt: Date;
}

export interface SitemapListing {
  items: SitemapEntry[];
  // Bundled with the page list rather than a separate lookup: both
  // sitemap.xml and robots.txt (apps/public-site) need "what does this
  // domain's site say about crawling", and both already need this same
  // site resolved by domain.
  searchEngineIndexingEnabled: boolean;
}

// "Siti vetrina" scale (this product's stated target, see
// piano-progetto-astro-cms.md) — a single page of results comfortably
// covers a real site's page count without needing a dedicated unpaginated
// repository method just for this.
const SITEMAP_PAGE_SIZE = 1000;

/**
 * Public, unauthenticated (see apps/api's PublicPagesModule) — only ever
 * lists published pages, same "no oracle for drafts" rule as
 * getPublishedPageBySlug. Returns `null` when the domain matches no site,
 * so the controller can 404 the same way it does for a missing page.
 */
export async function listPublishedPagesForSitemap(
  deps: ListPublishedPagesForSitemapDeps,
  input: ListPublishedPagesForSitemapInput,
): Promise<SitemapListing | null> {
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

  return {
    items: items
      .filter((page) => page.status === 'published')
      .map((page) => ({ slug: page.slug, updatedAt: page.updatedAt })),
    searchEngineIndexingEnabled: site.searchEngineIndexingEnabled,
  };
}
