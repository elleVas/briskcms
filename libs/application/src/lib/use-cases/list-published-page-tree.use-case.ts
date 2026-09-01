import type {
  PageGroupRepositoryPort,
  PageTranslationRepositoryPort,
  SiteRepositoryPort,
} from '@brisk/ports';

export interface ListPublishedPageTreeDeps {
  siteRepository: SiteRepositoryPort;
  pageGroupRepository: PageGroupRepositoryPort;
  pageTranslationRepository: PageTranslationRepositoryPort;
}

export interface ListPublishedPageTreeInput {
  tenantId: string;
  domain: string;
  locale: string;
}

export interface PageTreeNode {
  // Was the old Page's own id (per-locale) — now the shared PageGroup's
  // id, since the hierarchy this tree walks is shared across locales.
  id: string;
  parentId: string | null;
  slug: string;
  title: string;
  ancestorSlugs: string[];
  order: number;
  createdAt: string;
}

// Same "5-15 pagine, siti vetrina" scale assumption as
// listPublishedPagesForSitemap.use-case.ts.
const PAGE_TREE_PAGE_SIZE = 1000;
const MAX_ANCESTOR_WALK = 20;

/**
 * i18n a livello di campo (see the plan) — replaces the old Page-based
 * implementation, same "built for a theme's sidebar" purpose and public,
 * unauthenticated posture as before. Unlike the sitemap's own ancestor
 * walk, an ancestor with no translation in `input.locale` just truncates
 * `ancestorSlugs` early rather than dropping the whole entry — same
 * "structural fact vs. what's actually visible" distinction the original
 * had (this is auxiliary path info for a nav label, not a strict
 * reachability guarantee the way a sitemap URL needs to be).
 */
export async function listPublishedPageTree(
  deps: ListPublishedPageTreeDeps,
  input: ListPublishedPageTreeInput,
): Promise<PageTreeNode[] | null> {
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
    { page: 1, pageSize: PAGE_TREE_PAGE_SIZE },
  );
  const translationLists = await Promise.all(
    groups.map((group) =>
      deps.pageTranslationRepository.listByGroup(input.tenantId, group.id),
    ),
  );
  const translationsForLocale = translationLists
    .flat()
    .filter((translation) => translation.locale === input.locale);

  const parentIdByGroup = new Map<string, string | null>(
    groups.map((group) => [group.id, group.parentId]),
  );
  const orderByGroup = new Map<string, number>(
    groups.map((group) => [group.id, group.order]),
  );
  const translationByGroup = new Map(
    translationsForLocale.map((translation) => [
      translation.pageGroupId,
      translation,
    ]),
  );
  const publishedGroupIds = new Set(
    translationsForLocale
      .filter((translation) => translation.status === 'published')
      .map((translation) => translation.pageGroupId),
  );

  function ancestorSlugsFor(groupId: string): string[] {
    const slugs: string[] = [];
    let currentParentId = parentIdByGroup.get(groupId) ?? null;
    for (
      let hops = 0;
      currentParentId !== null && hops < MAX_ANCESTOR_WALK;
      hops += 1
    ) {
      const translation = translationByGroup.get(currentParentId);
      if (!translation) break;
      slugs.unshift(translation.slug);
      currentParentId = parentIdByGroup.get(currentParentId) ?? null;
    }
    return slugs;
  }

  return translationsForLocale
    .filter((translation) => translation.status === 'published')
    .map((translation) => {
      const parentId = parentIdByGroup.get(translation.pageGroupId) ?? null;
      return {
        id: translation.pageGroupId,
        // A parent that's unpublished (or doesn't exist) isn't something
        // the sidebar can link to or nest under — treated as a root entry
        // instead, same distinction as ancestorSlugsFor above.
        parentId: parentId && publishedGroupIds.has(parentId) ? parentId : null,
        slug: translation.slug,
        title: translation.seoMeta.title,
        ancestorSlugs: ancestorSlugsFor(translation.pageGroupId),
        order: orderByGroup.get(translation.pageGroupId) ?? 0,
        createdAt: translation.createdAt.toISOString(),
      };
    });
}
