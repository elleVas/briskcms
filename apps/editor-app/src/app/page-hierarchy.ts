import type { PageSummaryDto } from '../lib/pages-api-client.js';

function groupByParent(pages: PageSummaryDto[]): Map<string, PageSummaryDto[]> {
  const childrenByParent = new Map<string, PageSummaryDto[]>();
  for (const page of pages) {
    if (!page.parentId) continue;
    const siblings = childrenByParent.get(page.parentId) ?? [];
    siblings.push(page);
    childrenByParent.set(page.parentId, siblings);
  }
  return childrenByParent;
}

/** Every descendant of `rootId` within `pages` (not including `rootId` itself) — used to keep a parent picker from offering an obviously cyclic choice. The backend (setPageParent) remains the real authority. */
export function collectDescendantIds(
  pages: PageSummaryDto[],
  rootId: string,
): Set<string> {
  const childrenByParent = groupByParent(pages);
  const descendants = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    for (const child of childrenByParent.get(id) ?? []) {
      if (!descendants.has(child.id)) {
        descendants.add(child.id);
        stack.push(child.id);
      }
    }
  }
  return descendants;
}

export interface PageTreeNode {
  page: PageSummaryDto;
  depth: number;
}

/**
 * Depth-first, indented order (parent immediately followed by its
 * children) for rendering a simple nested list — no virtual root node, no
 * collapse/expand state. A page whose parentId isn't in `pages` (e.g. the
 * parent sits on a different page of a paginated result set) is treated
 * as a root rather than dropped — same "5-15 pagine per sito, una pagina
 * di risultati" scale assumption already used elsewhere (PagePickerDialog).
 */
export function buildPageTree(pages: PageSummaryDto[]): PageTreeNode[] {
  const childrenByParent = groupByParent(pages);
  const idsInList = new Set(pages.map((page) => page.id));
  const roots = pages.filter(
    (page) => !page.parentId || !idsInList.has(page.parentId),
  );

  const result: PageTreeNode[] = [];
  function visit(page: PageSummaryDto, depth: number) {
    result.push({ page, depth });
    for (const child of childrenByParent.get(page.id) ?? []) {
      visit(child, depth + 1);
    }
  }
  for (const root of roots) {
    visit(root, 0);
  }
  return result;
}
