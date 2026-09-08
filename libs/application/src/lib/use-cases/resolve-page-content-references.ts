import {
  collectPageGroupReferences,
  resolvePageReferences,
  type PageContent,
  type PageGroupSlugMap,
} from '@brisk/shared-types';
import type {
  PageGroupRepositoryPort,
  PageTranslationRepositoryPort,
  ReusableSectionRepositoryPort,
} from '@brisk/ports';
import { resolveAncestorGroupIds } from './resolve-page-group-ancestors';
import { resolveSectionInstances } from './resolve-section-instances';

export interface ResolvePageContentReferencesDeps {
  pageGroupRepository: PageGroupRepositoryPort;
  pageTranslationRepository: PageTranslationRepositoryPort;
  reusableSectionRepository: ReusableSectionRepositoryPort;
}

/**
 * i18n a livello di campo (see the plan) — resolves every `page` reference
 * (Link/NavLink/Button/Banner/PromoBar/PricingPlan's shared `page` field)
 * across one or more content trees (page content, header, footer — all
 * rendered together, so a single combined lookup dedups any group
 * referenced from more than one of them) into the locale actually being
 * rendered. Fixes a real bug: `pickedPageSchema` used to bake in a
 * specific locale+slug at PICK time, reused verbatim for every locale of
 * the containing block since `page` isn't a `translatable` field — an IT
 * reader could get an EN link.
 *
 * It also expands section instances, and it does that FIRST (docs/adr/0059).
 * The order is not a detail: a reusable section can hold a Link, and that
 * link has to be resolved in the locale being rendered like any other.
 * Resolving links first and expanding sections afterwards would produce a
 * page whose section links all pointed nowhere — with nothing failing, on
 * exactly the pages that used a section. Doing both here, rather than
 * leaving the caller to sequence them, is what makes that impossible to
 * get wrong at the four call sites.
 */
export async function resolvePageContentReferences(
  deps: ResolvePageContentReferencesDeps,
  tenantId: string,
  locale: string,
  rawContents: PageContent[],
): Promise<PageContent[]> {
  const contents = await resolveSectionInstances(deps, tenantId, rawContents);

  const referencedGroupIds = new Set<string>();
  for (const content of contents) {
    for (const groupId of collectPageGroupReferences(content)) {
      referencedGroupIds.add(groupId);
    }
  }
  if (referencedGroupIds.size === 0) {
    return contents;
  }

  // Memoised across the whole pass: a navigation menu of eight links into
  // the same section asks for that section's translation eight times
  // otherwise, once per link, on every request.
  const translationCache = new Map<string, Promise<{ slug: string } | null>>();
  function translationOf(groupId: string): Promise<{ slug: string } | null> {
    let pending = translationCache.get(groupId);
    if (!pending) {
      pending = deps.pageTranslationRepository
        .findByGroupAndLocale(tenantId, groupId, locale)
        .then((found) => (found ? { slug: found.slug } : null));
      translationCache.set(groupId, pending);
    }
    return pending;
  }

  const slugByGroupId: PageGroupSlugMap = new Map();
  await Promise.all(
    [...referencedGroupIds].map(async (pageGroupId) => {
      const translation = await translationOf(pageGroupId);
      if (!translation) {
        return;
      }
      const group = await deps.pageGroupRepository.findById(
        tenantId,
        pageGroupId,
      );
      const ancestorGroupIds = await resolveAncestorGroupIds(
        deps.pageGroupRepository,
        tenantId,
        group?.parentId ?? null,
      );
      const ancestorSlugs: string[] = [];
      for (const ancestorId of ancestorGroupIds) {
        const ancestor = await translationOf(ancestorId);
        // No translation for an ancestor means no URL reaches this page
        // in this locale at all — the top-down walk would stop at the
        // missing segment. Leaving it out of the map makes the reference
        // resolve to `null`, which every block already renders as "no
        // link", rather than as a link to a 404.
        if (!ancestor) {
          return;
        }
        ancestorSlugs.push(ancestor.slug);
      }
      slugByGroupId.set(pageGroupId, {
        locale,
        slug: translation.slug,
        ancestorSlugs,
      });
    }),
  );

  return contents.map((content) =>
    resolvePageReferences(content, slugByGroupId),
  );
}
