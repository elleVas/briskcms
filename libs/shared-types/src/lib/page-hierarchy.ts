export interface PageHierarchyNode {
  id: string;
  parentId: string | null;
  slug: string;
}

// Safety net only — real sites are 1-3 levels deep (see the "5-15 pagine
// per sito" assumption used throughout this codebase), this guards
// against an unexpected cycle looping forever rather than a realistic
// depth.
const MAX_ANCESTOR_WALK = 20;

/**
 * Pure in-memory ancestor walk given a map of every node a caller already
 * has in hand (e.g. a whole site's pages) — no I/O. Root-to-parent order,
 * does not include `pageId` itself. Used where the full page list is
 * already fetched for another reason (the sitemap use-case); a single
 * page's ancestors elsewhere in the codebase are resolved via a small I/O
 * loop instead (see getPublishedPageBySlug), since fetching a whole
 * site's pages just to answer one page's ancestry would be wasted work.
 */
export function resolveAncestorSlugs(
  nodesById: Map<string, PageHierarchyNode>,
  pageId: string,
): string[] {
  const slugs: string[] = [];
  let currentId = nodesById.get(pageId)?.parentId ?? null;
  for (
    let hops = 0;
    currentId !== null && hops < MAX_ANCESTOR_WALK;
    hops += 1
  ) {
    const current = nodesById.get(currentId);
    if (!current) break;
    slugs.unshift(current.slug);
    currentId = current.parentId;
  }
  return slugs;
}
