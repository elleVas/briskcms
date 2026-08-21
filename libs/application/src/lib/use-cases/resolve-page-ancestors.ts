import type { PageRepositoryPort } from '@brisk/ports';

// Safety net only — real sites are 1-3 levels deep (see the "5-15 pagine
// per sito" assumption used throughout this codebase), this guards
// against an unexpected cycle looping forever rather than a realistic
// depth.
const MAX_ANCESTOR_WALK = 20;

/** Root-to-parent order (does not include the page itself). Empty for a root-level page. */
export interface PageAncestor {
  slug: string;
  title: string;
}

/**
 * Shared by getPublishedPageBySlug and getPreviewPageById — walks parentId
 * one hop at a time via findById, fine at this product's scale (a handful
 * of hops at most), not worth fetching the whole site's page list just to
 * resolve one page's ancestors. Root-to-parent order. Deliberately doesn't
 * gate on any ancestor's own `status`: a preview caller is already
 * authenticated via a valid preview token for the page itself, and the
 * published path never surfaces an ancestor whose own slug/title would be
 * wrong to show (a draft ancestor still has a real slug/title, same as any
 * other page row).
 */
export async function resolvePageAncestors(
  pageRepository: PageRepositoryPort,
  tenantId: string,
  parentId: string | null,
): Promise<PageAncestor[]> {
  const ancestors: PageAncestor[] = [];
  let currentId = parentId;
  for (
    let hops = 0;
    currentId !== null && hops < MAX_ANCESTOR_WALK;
    hops += 1
  ) {
    const current = await pageRepository.findById(tenantId, currentId);
    if (!current) break;
    ancestors.unshift({
      slug: current.slug,
      title: current.seoMeta.title || current.slug,
    });
    currentId = current.parentId;
  }
  return ancestors;
}
