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
 * Alphabetical, or newest first.
 *
 * A page with no publication date sorts last rather than first: unlike
 * the editor, where an unpublished draft is the row asking for
 * attention, a reader arriving at an archive is owed the most recent
 * thing at the top, and a missing date means "we do not know", not
 * "today".
 */
function compareItems(order: unknown) {
  if (order !== 'newest') {
    return (a: PageGridItem, b: PageGridItem) => a.title.localeCompare(b.title);
  }
  return (a: PageGridItem, b: PageGridItem) => {
    if (a.publishedAt === b.publishedAt) return a.title.localeCompare(b.title);
    if (!a.publishedAt) return 1;
    if (!b.publishedAt) return -1;
    return b.publishedAt.localeCompare(a.publishedAt);
  };
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
  /**
   * Which of the terms a filter on this page offers each page carries —
   * see `resolveTermLists`. Empty when the page has no filter on it, and
   * then every entry simply says it answers to nothing.
   */
  slugsByGroup: Map<string, string[]> = new Map(),
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
        publishedAt: path.publishedAt ? path.publishedAt.toISOString() : null,
        excerpt: path.description,
        image: path.image,
        termSlugs: slugsByGroup.get(groupId) ?? [],
      });
    }
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
    // Sorted here and not once per term: two grids on the same page may
    // list the same term in two different orders, and one shared sorted
    // array would hand the second one the first one's answer.
    const items =
      typeof termId === 'string' ? (itemsByTerm.get(termId) ?? []) : [];
    const sorted = [...items].sort(compareItems(block.props['order']));
    const next: Block = { ...block, props: { ...block.props, items: sorted } };
    return children ? { ...next, children } : next;
  });
}
