import type { PageGroup, PageTranslation } from '@brisk/domain-core';
import type {
  PageGroupRepositoryPort,
  PageTranslationRepositoryPort,
} from '@brisk/ports';
import type { PageAncestor } from './resolve-page-group-ancestors';

// Same safety net as resolvePageByPath's own MAX_PATH_SEGMENTS.
const MAX_PATH_SEGMENTS = 20;

export interface PageGroupByPath {
  group: PageGroup;
  translation: PageTranslation;
  /** Root-to-parent order, same shape as resolvePageByPath's own. */
  ancestors: PageAncestor[];
  /**
   * At least one segment of the requested path was an address a page has
   * since left, so this path is not where the page lives any more.
   *
   * The caller answers with a 301 to `currentPath` rather than serving
   * the page here: two addresses both serving the same content is the
   * duplicate the whole rename mechanism exists to avoid.
   */
  moved: boolean;
  /** Root-to-leaf, the addresses these pages answer at NOW. */
  currentPath: string[];
}

/**
 * PageGroup-based replacement for resolvePageByPath — walks the URL path
 * top-down one segment at a time via
 * PageTranslationRepositoryPort.findByParentGroupAndLocaleSlug (its own
 * doc comment describes exactly this loop), same reasoning as the
 * original: sibling-scoped slugs make the trailing segment alone
 * ambiguous. `parentGroupId` threads through as the previous hop's
 * `pageGroupId` — the shared hierarchy anchor, replacing the old
 * `parentId = page.id` chaining.
 */
export async function resolvePageGroupByPath(
  deps: {
    pageGroupRepository: PageGroupRepositoryPort;
    pageTranslationRepository: PageTranslationRepositoryPort;
  },
  tenantId: string,
  siteId: string,
  locale: string,
  segments: string[],
): Promise<PageGroupByPath | null> {
  if (segments.length === 0 || segments.length > MAX_PATH_SEGMENTS) {
    return null;
  }

  const ancestors: PageAncestor[] = [];
  const currentPath: string[] = [];
  let parentGroupId: string | null = null;
  let translation: PageTranslation | null = null;
  let moved = false;

  for (let i = 0; i < segments.length; i += 1) {
    translation =
      await deps.pageTranslationRepository.findByParentGroupAndLocaleSlug(
        tenantId,
        siteId,
        locale,
        parentGroupId,
        segments[i],
      );
    if (!translation) {
      // Nothing answers here now — but something may have, before it was
      // renamed. Asked at EVERY level, not only the last: renaming a
      // section changes the address of everything underneath it, and a
      // link to a child is exactly as saved and as followed as a link to
      // the section itself.
      translation = await deps.pageTranslationRepository.findByFormerSlug(
        tenantId,
        siteId,
        locale,
        parentGroupId,
        segments[i],
      );
      if (!translation) return null;
      moved = true;
    }
    currentPath.push(translation.slug);
    if (i < segments.length - 1) {
      ancestors.push({
        slug: translation.slug,
        title: translation.seoMeta.title || translation.slug,
      });
    }
    parentGroupId = translation.pageGroupId;
  }
  if (!translation) return null;

  const group = await deps.pageGroupRepository.findById(
    tenantId,
    translation.pageGroupId,
  );
  if (!group) return null;

  return { group, translation, ancestors, moved, currentPath };
}
