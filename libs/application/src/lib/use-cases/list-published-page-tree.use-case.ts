import type { PageRepositoryPort, SiteRepositoryPort } from '@brisk/ports';
import {
  resolveAncestorSlugs,
  type PageHierarchyNode,
} from '@brisk/shared-types';

export interface ListPublishedPageTreeDeps {
  siteRepository: SiteRepositoryPort;
  pageRepository: PageRepositoryPort;
}

export interface ListPublishedPageTreeInput {
  tenantId: string;
  domain: string;
  locale: string;
}

export interface PageTreeNode {
  id: string;
  parentId: string | null;
  slug: string;
  title: string;
  ancestorSlugs: string[];
  // Sibling-scoped position (see reorderSiblingPages) — the sort key a
  // theme's sidebar should actually use now; createdAt below stays only as
  // a legacy tiebreak for pages that predate manual ordering.
  order: number;
  // ISO string, not a `Date` — this crosses the public HTTP boundary as
  // JSON, only ever needed as a stable tiebreak, never date arithmetic.
  createdAt: string;
}

// Same "5-15 pagine, siti vetrina" scale assumption as
// listPublishedPagesForSitemap.use-case.ts — one page of results is
// always enough.
const PAGE_TREE_PAGE_SIZE = 1000;

/**
 * Public, unauthenticated — same domain-resolution pattern as
 * listPublishedPagesForSitemap. Built for a theme's own sidebar/tree
 * navigation (docs-showcase, docs/adr/0021's per-block override escalation)
 * — the existing sitemap listing has ancestor *slugs* but not titles, no
 * good for rendering a nav link's label. Flat list, not a nested tree: the
 * caller (a theme's PageLayout.astro override) is in a better position to
 * decide how to group/nest it than this use case is.
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

  const { items } = await deps.pageRepository.listBySite(
    input.tenantId,
    site.id,
    { page: 1, pageSize: PAGE_TREE_PAGE_SIZE },
  );

  // Built from every page (draft included), same reasoning as
  // listPublishedPagesForSitemap.use-case.ts — a page's ancestors are a
  // structural fact of the hierarchy, independent of whether an ancestor
  // itself happens to be published yet.
  const nodesById = new Map<string, PageHierarchyNode>(
    items.map((page) => [
      page.id,
      { id: page.id, parentId: page.parentId, slug: page.slug },
    ]),
  );
  const publishedIds = new Set(
    items.filter((page) => page.status === 'published').map((page) => page.id),
  );

  return items
    .filter(
      (page) => page.status === 'published' && page.locale === input.locale,
    )
    .map((page) => ({
      id: page.id,
      // A parent that's unpublished (or doesn't exist) isn't something the
      // sidebar can link to or nest under — treated as a root entry
      // instead, same "structural fact vs. what's actually visible"
      // distinction as ancestorSlugs below.
      parentId:
        page.parentId && publishedIds.has(page.parentId) ? page.parentId : null,
      slug: page.slug,
      title: page.seoMeta.title,
      ancestorSlugs: resolveAncestorSlugs(nodesById, page.id),
      order: page.order,
      createdAt: page.createdAt.toISOString(),
    }));
}
