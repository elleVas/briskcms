import {
  collectPageGroupReferences,
  resolvePageReferences,
  type PageContent,
  type PageGroupSlugMap,
} from '@brisk/shared-types';
import type { PageTranslationRepositoryPort } from '@brisk/ports';

export interface ResolvePageContentReferencesDeps {
  pageTranslationRepository: PageTranslationRepositoryPort;
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
 */
export async function resolvePageContentReferences(
  deps: ResolvePageContentReferencesDeps,
  tenantId: string,
  locale: string,
  contents: PageContent[],
): Promise<PageContent[]> {
  const referencedGroupIds = new Set<string>();
  for (const content of contents) {
    for (const groupId of collectPageGroupReferences(content)) {
      referencedGroupIds.add(groupId);
    }
  }
  if (referencedGroupIds.size === 0) {
    return contents;
  }

  const slugByGroupId: PageGroupSlugMap = new Map();
  await Promise.all(
    [...referencedGroupIds].map(async (pageGroupId) => {
      const translation =
        await deps.pageTranslationRepository.findByGroupAndLocale(
          tenantId,
          pageGroupId,
          locale,
        );
      if (translation) {
        slugByGroupId.set(pageGroupId, {
          locale: translation.locale,
          slug: translation.slug,
        });
      }
    }),
  );

  return contents.map((content) =>
    resolvePageReferences(content, slugByGroupId),
  );
}
