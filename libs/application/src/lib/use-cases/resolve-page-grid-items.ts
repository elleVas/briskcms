import type { Block, PageContent, PageGridItem } from '@brisk/shared-types';
import { localePathFromAncestors } from '@brisk/theme-runtime';
import type {
  PageGroupRepositoryPort,
  PageTranslationRepositoryPort,
  TaxonomyRepositoryPort,
} from '@brisk/ports';
import { listPublishedPagePaths } from './list-published-page-paths';

export interface ResolvePageGridItemsDeps {
  taxonomyRepository: TaxonomyRepositoryPort;
  pageGroupRepository: PageGroupRepositoryPort;
  pageTranslationRepository: PageTranslationRepositoryPort;
}

function collectTermIds(blocks: PageContent, into: Set<string>): void {
  for (const block of blocks) {
    if (block.type === 'PageGrid') {
      const termId = block.props['termId'];
      if (typeof termId === 'string' && termId !== '') into.add(termId);
    }
    if (block.children) collectTermIds(block.children, into);
  }
}

/**
 * Fills in what each `PageGrid` block on a page is listing.
 *
 * The same treatment a picked page's address already gets
 * (`resolvePageReferences`): the block stores WHICH pages it wants — a
 * term — and this pass turns that into the titles and addresses they
 * have in the language being rendered. Nothing here is authorable, and
 * that is the point: the list is the answer to a query, not content
 * somebody typed (docs/adr/0064).
 *
 * A term with no pages, a term that was deleted, a block with no term
 * chosen: all three end as an empty list. The block draws its "nothing
 * here" text and the page renders — a classification that lost its
 * contents must not take a page down with it.
 */
export async function resolvePageGridItems(
  deps: ResolvePageGridItemsDeps,
  tenantId: string,
  siteId: string,
  locale: string,
  contents: PageContent[],
): Promise<PageContent[]> {
  const termIds = new Set<string>();
  for (const content of contents) collectTermIds(content, termIds);
  if (termIds.size === 0) {
    return contents;
  }

  // One walk of the site's hierarchy for every grid on the page, not one
  // per block: two grids listing two terms are still one question about
  // where this site's pages live.
  const [paths, ...groupIdLists] = await Promise.all([
    listPublishedPagePaths(deps, tenantId, siteId),
    ...[...termIds].map((termId) =>
      deps.taxonomyRepository.listPageGroupIdsForTerm(tenantId, termId),
    ),
  ]);
  const pathByGroup = new Map(
    paths
      .filter((path) => path.locale === locale)
      .map((path) => [path.groupId, path]),
  );

  const itemsByTerm = new Map<string, PageGridItem[]>();
  [...termIds].forEach((termId, index) => {
    const items: PageGridItem[] = [];
    for (const groupId of groupIdLists[index] ?? []) {
      const path = pathByGroup.get(groupId);
      // Absent = that page has no published translation in this
      // language, or its ancestor chain has a gap there. Either way it
      // has no address to link to, so it is not listed rather than
      // listed as a dead link.
      if (!path) continue;
      items.push({
        pageGroupId: groupId,
        title: path.title,
        path: localePathFromAncestors(locale, path.ancestorSlugs, path.slug),
      });
    }
    items.sort((a, b) => a.title.localeCompare(b.title));
    itemsByTerm.set(termId, items);
  });

  return contents.map((content) => fillBlocks(content, itemsByTerm));
}

function fillBlocks(
  blocks: PageContent,
  itemsByTerm: Map<string, PageGridItem[]>,
): PageContent {
  return blocks.map((block) => {
    const children = block.children
      ? fillBlocks(block.children, itemsByTerm)
      : undefined;
    if (block.type !== 'PageGrid') {
      return children ? { ...block, children } : block;
    }
    const termId = block.props['termId'];
    const items =
      typeof termId === 'string' ? (itemsByTerm.get(termId) ?? []) : [];
    const next: Block = { ...block, props: { ...block.props, items } };
    return children ? { ...next, children } : next;
  });
}
