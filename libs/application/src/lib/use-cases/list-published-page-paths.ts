import type {
  PageGroupRepositoryPort,
  PageTranslationRepositoryPort,
} from '@brisk/ports';
import type { PageTranslation } from '@brisk/domain-core';

export interface ListPublishedPagePathsDeps {
  pageGroupRepository: PageGroupRepositoryPort;
  pageTranslationRepository: PageTranslationRepositoryPort;
}

/** Where one published translation actually lives, and what to call it. */
export interface PublishedPagePath {
  groupId: string;
  locale: string;
  slug: string;
  /** Root-to-parent, in THIS language — slugs are sibling-scoped (ADR-0029), so a slug alone is not an address. */
  ancestorSlugs: string[];
  /** What a link to it should say: the SEO title when there is one, the slug otherwise — the same `seoMeta.title || slug` rule the rest of the codebase uses. */
  title: string;
  /** The summary its author already wrote for search engines, reused rather than invented a second time. */
  description: string;
  /** The picture it already shows when shared — the same one a card wants. */
  image: string | null;
  /** When this language went live. `null` only for a page published before the column existed. */
  publishedAt: Date | null;
  updatedAt: Date;
}

// Same "5-15 pagine, siti vetrina" scale assumption as everywhere else.
const PAGE_SIZE = 1000;
const MAX_ANCESTOR_WALK = 20;

/**
 * `null` when the FULL ancestor chain has a translation in `locale` at
 * every level.
 *
 * The shared PageGroup hierarchy makes it possible for a leaf to be
 * published while an ANCESTOR group has no translation in that same
 * language. Such a leaf is not reachable at any real URL
 * (`resolvePageGroupByPath` would 404 walking down to it) even though it
 * is individually "published", so a caller must skip it rather than
 * build a path that answers nothing.
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
 * Every published page of one site, with the address it answers at.
 *
 * One implementation of "where does this page live", shared by the
 * sitemap and by the page lists a term draws (docs/adr/0064) — they were
 * about to be two walks of the same hierarchy, which is exactly how two
 * answers to one question start disagreeing.
 */
export async function listPublishedPagePaths(
  deps: ListPublishedPagePathsDeps,
  tenantId: string,
  siteId: string,
): Promise<PublishedPagePath[]> {
  const { items: groups } = await deps.pageGroupRepository.listBySite(
    tenantId,
    siteId,
    { page: 1, pageSize: PAGE_SIZE },
  );
  const translationLists = await Promise.all(
    groups.map((group) =>
      deps.pageTranslationRepository.listByGroup(tenantId, group.id),
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

  const paths: PublishedPagePath[] = [];
  for (const translation of translations) {
    if (translation.status !== 'published') continue;
    const ancestorSlugs = resolveAncestorSlugsOrNull(
      parentIdByGroup,
      translationsByGroupAndLocale,
      translation.pageGroupId,
      translation.locale,
    );
    if (ancestorSlugs === null) continue;
    paths.push({
      groupId: translation.pageGroupId,
      locale: translation.locale,
      slug: translation.slug,
      ancestorSlugs,
      title: translation.seoMeta.title.trim() || translation.slug,
      description: translation.seoMeta.description,
      image: translation.seoMeta.ogTags?.['image'] ?? null,
      publishedAt: translation.publishedAt,
      updatedAt: translation.updatedAt,
    });
  }
  return paths;
}
