import type {
  PageGroupRepositoryPort,
  PageTranslationRepositoryPort,
} from '@brisk/ports';

// Real sites are 1-3 levels deep (see the "5-15 pagine per sito"
// assumption used throughout this codebase) — this guards against an
// unexpected cycle looping forever rather than a realistic depth.
const MAX_ANCESTOR_WALK = 20;

/** Root-to-parent order (does not include the page itself). Empty for a root-level page. */
export interface PageAncestor {
  slug: string;
  title: string;
}

/**
 * Shared by getPublishedPageBySlug (via resolvePageGroupByPath) and
 * getPreviewPageById — walks the SHARED hierarchy (PageGroup.parentId)
 * one hop at a time. The hierarchy walk itself doesn't need a
 * locale (it's shared), but the slug/title shown for each ancestor does:
 * tries `locale` first, falls back to `defaultLocale` if that ancestor
 * group has no translation there — same fallback precedent as
 * resolveUntranslatedPageFallback (a group can have its default-locale
 * translation deleted while a sibling elsewhere still exists). An
 * ancestor with NEITHER is silently skipped (not surfaced as a broken
 * crumb) rather than aborting the whole walk — the leaf page itself still
 * resolved, a missing breadcrumb label for one ancestor isn't worth
 * hiding the rest of the trail.
 */
export async function resolvePageGroupAncestors(
  deps: {
    pageGroupRepository: PageGroupRepositoryPort;
    pageTranslationRepository: PageTranslationRepositoryPort;
  },
  tenantId: string,
  locale: string,
  defaultLocale: string,
  parentGroupId: string | null,
): Promise<PageAncestor[]> {
  const ancestors: PageAncestor[] = [];
  let currentGroupId = parentGroupId;

  for (
    let hops = 0;
    currentGroupId !== null && hops < MAX_ANCESTOR_WALK;
    hops += 1
  ) {
    const group = await deps.pageGroupRepository.findById(
      tenantId,
      currentGroupId,
    );
    if (!group) break;

    const translation =
      (await deps.pageTranslationRepository.findByGroupAndLocale(
        tenantId,
        group.id,
        locale,
      )) ??
      (locale === defaultLocale
        ? null
        : await deps.pageTranslationRepository.findByGroupAndLocale(
            tenantId,
            group.id,
            defaultLocale,
          ));
    if (translation) {
      ancestors.unshift({
        slug: translation.slug,
        title: translation.seoMeta.title || translation.slug,
      });
    }

    currentGroupId = group.parentId;
  }

  return ancestors;
}
