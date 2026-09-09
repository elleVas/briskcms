import type {
  PageGroupRepositoryPort,
  PageTranslationRepositoryPort,
  SiteRepositoryPort,
} from '@brisk/ports';
import { listPublishedPagePaths } from './list-published-page-paths';

export interface ListPublishedPagesForSitemapDeps {
  siteRepository: SiteRepositoryPort;
  pageGroupRepository: PageGroupRepositoryPort;
  pageTranslationRepository: PageTranslationRepositoryPort;
}

export interface ListPublishedPagesForSitemapInput {
  tenantId: string;
  domain: string;
}

export interface SitemapEntry {
  slug: string;
  locale: string;
  // Links locale-siblings together so apps/public-site can group entries
  // into one <url> block with hreflang alternates per group, instead of
  // one flat <loc> per page regardless of translation. Was the old Page's
  // denormalized `groupId` field — now this IS the PageGroup's own id.
  groupId: string;
  // Root-to-parent slugs (page hierarchy) — lets the sitemap list the
  // canonical nested URL directly instead of a flat one that would just
  // 301-redirect, see apps/public-site's [locale]/[...slug].astro.
  ancestorSlugs: string[];
  updatedAt: Date;
}

export interface SitemapListing {
  items: SitemapEntry[];
  searchEngineIndexingEnabled: boolean;
  defaultLocale: string;
}

/**
 * i18n a livello di campo (see the plan) — replaces the old Page-based
 * implementation. Public, unauthenticated, same domain-resolution and
 * "empty listing on unknown domain, not an error" posture as before.
 *
 * The hierarchy walk itself moved to `listPublishedPagePaths`, which the
 * page lists a term draws also need (docs/adr/0064): two walks of the
 * same tree is how two answers to one question start disagreeing.
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

  const paths = await listPublishedPagePaths(deps, input.tenantId, site.id);

  return {
    items: paths.map((path) => ({
      slug: path.slug,
      locale: path.locale,
      groupId: path.groupId,
      ancestorSlugs: path.ancestorSlugs,
      updatedAt: path.updatedAt,
    })),
    searchEngineIndexingEnabled: site.searchEngineIndexingEnabled,
    defaultLocale: site.defaultLocale,
  };
}
