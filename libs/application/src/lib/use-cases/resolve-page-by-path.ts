import type { Page } from '@brisk/domain-core';
import type { PageRepositoryPort } from '@brisk/ports';
import type { PageAncestor } from './resolve-page-ancestors';

// Same safety net as resolvePageAncestors' own MAX_ANCESTOR_WALK — real
// sites are 1-3 levels deep.
const MAX_PATH_SEGMENTS = 20;

export interface PageByPath {
  page: Page;
  /** Root-to-parent order, same shape as resolvePageAncestors' own — see below for why this doesn't need a separate upward walk. */
  ancestors: PageAncestor[];
}

/**
 * Sibling-scoped slug uniqueness (see schema.ts's `pages` unique
 * constraints) means a page can only be found by walking its full URL
 * path top-down, one segment at a time — the trailing segment alone is
 * ambiguous once the same slug text can legitimately exist under more
 * than one parent. Collects the ancestor chain (root-to-parent order)
 * along the way instead of a separate upward walk afterwards
 * (resolvePageAncestors, still used by getPreviewPageById which starts
 * from a known page id, not a path): every ancestor is already visited
 * here, in the right order, for free.
 */
export async function resolvePageByPath(
  pageRepository: PageRepositoryPort,
  tenantId: string,
  siteId: string,
  locale: string,
  segments: string[],
): Promise<PageByPath | null> {
  if (segments.length === 0 || segments.length > MAX_PATH_SEGMENTS) {
    return null;
  }

  const ancestors: PageAncestor[] = [];
  let parentId: string | null = null;
  let page: Page | null = null;

  for (let i = 0; i < segments.length; i += 1) {
    page = await pageRepository.findByParentAndSlug(
      tenantId,
      siteId,
      locale,
      parentId,
      segments[i],
    );
    if (!page) return null;
    if (i < segments.length - 1) {
      ancestors.push({
        slug: page.slug,
        title: page.seoMeta.title || page.slug,
      });
    }
    parentId = page.id;
  }

  return page ? { page, ancestors } : null;
}
