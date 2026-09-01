import type { Block, PageContent } from './content-model';
import { pickedPageSchema } from './content-model';

/** groupId -> where that group resolves for one specific rendering locale. */
export type PageGroupSlugMap = Map<string, { locale: string; slug: string }>;

function isPageRefLike(value: unknown): value is { pageGroupId: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'pageGroupId' in value &&
    typeof (value as { pageGroupId: unknown }).pageGroupId === 'string'
  );
}

/**
 * Walks a tree collecting every `pageGroupId` a `page` prop references
 * (Link/NavLink/Button/Banner/PromoBar/PricingPlan all share the same
 * `page` field key via ctaLinkFields(), see link-type-field.ts) — the
 * caller fetches a (locale, slug) for exactly these ids before calling
 * `resolvePageReferences`, same "pre-fetch a map, then pure walk" pattern
 * as page-hierarchy.ts's own resolveAncestorSlugs.
 */
export function collectPageGroupReferences(content: PageContent): Set<string> {
  const ids = new Set<string>();
  function walk(blocks: Block[]): void {
    for (const block of blocks) {
      const page = block.props['page'];
      if (isPageRefLike(page)) {
        ids.add(page.pageGroupId);
      }
      if (block.children) {
        walk(block.children);
      }
    }
  }
  walk(content);
  return ids;
}

/**
 * The reverse of `collectPageGroupReferences` — walks a tree that's
 * ALREADY been through `resolvePageReferences` and harvests its resolved
 * (pageGroupId -> locale/slug) pairs. Used by apps/public-site's
 * render-block-fragment.ts: the single block it live-previews is built
 * fresh from the editor's raw (unresolved) props on every edit, but the
 * REST of the page it already fetched (via getPreviewPageById) is already
 * resolved — reusing those pairs here means an edit to some OTHER prop on
 * a Link/NavLink/etc. block doesn't need a second round-trip just to keep
 * showing that block's own already-known destination.
 */
export function collectResolvedPageRefs(
  content: PageContent,
): PageGroupSlugMap {
  const map: PageGroupSlugMap = new Map();
  function walk(blocks: Block[]): void {
    for (const block of blocks) {
      const parsed = pickedPageSchema.safeParse(block.props['page']);
      if (parsed.success && parsed.data.locale && parsed.data.slug) {
        map.set(parsed.data.pageGroupId, {
          locale: parsed.data.locale,
          slug: parsed.data.slug,
        });
      }
      if (block.children) {
        walk(block.children);
      }
    }
  }
  walk(content);
  return map;
}

function resolveBlock(block: Block, slugByGroupId: PageGroupSlugMap): Block {
  const page = block.props['page'];
  const children = block.children?.map((child) =>
    resolveBlock(child, slugByGroupId),
  );
  if (!isPageRefLike(page)) {
    return children ? { ...block, children } : block;
  }
  const resolved = slugByGroupId.get(page.pageGroupId);
  return {
    ...block,
    // `null`, not a dangling ref, when the group has no translation in
    // this locale (deleted, or never translated) — same "nothing to link
    // to" state a field that was never picked at all already renders as
    // (Link.astro's own `linkType === 'page' && page` guard).
    props: { ...block.props, page: resolved ? { ...page, ...resolved } : null },
    ...(children ? { children } : {}),
  };
}

/**
 * Rewrites every `page` reference in a tree from its stored, locale-
 * independent form (`{pageGroupId, title}`) to the resolved form
 * apps/public-site's block components read (`{pageGroupId, title, locale,
 * slug}`) — for the ONE locale `slugByGroupId` was built for. Pure,
 * synchronous: the caller has already fetched every referenced group's
 * translation for that locale (see collectPageGroupReferences).
 */
export function resolvePageReferences(
  content: PageContent,
  slugByGroupId: PageGroupSlugMap,
): PageContent {
  return content.map((block) => resolveBlock(block, slugByGroupId));
}
