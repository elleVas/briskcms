import type {
  PageGroupRepositoryPort,
  PageTranslationRepositoryPort,
  SiteRepositoryPort,
} from '@brisk/ports';
import type { PageTranslation } from '@brisk/domain-core';

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

// Same "5-15 pagine, siti vetrina" scale assumption as everywhere else.
const SITEMAP_PAGE_SIZE = 1000;
const MAX_ANCESTOR_WALK = 20;

/**
 * `null` when the FULL ancestor chain for `groupId` has a translation in
 * `locale` at every level, `null`-returning early otherwise — unlike the
 * old single-locale Page hierarchy (where an ancestor was always
 * guaranteed to exist in the same locale by construction), the shared
 * PageGroup hierarchy makes it possible for a leaf translation to be
 * published while an ANCESTOR group has no translation in that same
 * locale. Such a leaf isn't actually reachable at any real URL
 * (resolvePageGroupByPath would 404 walking down to it) even though it's
 * individually "published" — listing it in the sitemap would just hand
 * search engines a dead link, so the caller skips the whole entry instead
 * of emitting a wrong/partial path.
 */
function resolveAncestorSlugsOrNull(
  parentIdByGroup: Map<string, string | null>,
  translationsByGroupAndLocale: Map<string, PageTranslation>,
  groupId: string,
  locale: string,
): string[] | null {
  const slugs: string[] = [];
  let currentParentId = parentIdByGroup.get(groupId) ?? null;
  for (
    let hops = 0;
    currentParentId !== null && hops < MAX_ANCESTOR_WALK;
    hops += 1
  ) {
    const translation = translationsByGroupAndLocale.get(
      `${currentParentId}:${locale}`,
    );
    if (!translation) return null;
    slugs.unshift(translation.slug);
    currentParentId = parentIdByGroup.get(currentParentId) ?? null;
  }
  return slugs;
}

/**
 * i18n a livello di campo (see the plan) — replaces the old Page-based
 * implementation. Public, unauthenticated, same domain-resolution and
 * "empty listing on unknown domain, not an error" posture as before.
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

  const { items: groups } = await deps.pageGroupRepository.listBySite(
    input.tenantId,
    site.id,
    { page: 1, pageSize: SITEMAP_PAGE_SIZE },
  );
  const translationLists = await Promise.all(
    groups.map((group) =>
      deps.pageTranslationRepository.listByGroup(input.tenantId, group.id),
    ),
  );
  const translations = translationLists.flat();

  const parentIdByGroup = new Map<string, string | null>(
    groups.map((group) => [group.id, group.parentId]),
  );
  const translationsByGroupAndLocale = new Map<string, PageTranslation>(
    translations.map((translation) => [
      `${translation.pageGroupId}:${translation.locale}`,
      translation,
    ]),
  );

  const items: SitemapEntry[] = [];
  for (const translation of translations) {
    if (translation.status !== 'published') continue;
    const ancestorSlugs = resolveAncestorSlugsOrNull(
      parentIdByGroup,
      translationsByGroupAndLocale,
      translation.pageGroupId,
      translation.locale,
    );
    if (ancestorSlugs === null) continue;
    items.push({
      slug: translation.slug,
      locale: translation.locale,
      groupId: translation.pageGroupId,
      ancestorSlugs,
      updatedAt: translation.updatedAt,
    });
  }

  return {
    items,
    searchEngineIndexingEnabled: site.searchEngineIndexingEnabled,
    defaultLocale: site.defaultLocale,
  };
}
