export interface HierarchyItem {
  id: string;
  parentId: string | null;
}

function groupByParent<T extends HierarchyItem>(items: T[]): Map<string, T[]> {
  const childrenByParent = new Map<string, T[]>();
  for (const item of items) {
    if (!item.parentId) continue;
    const siblings = childrenByParent.get(item.parentId) ?? [];
    siblings.push(item);
    childrenByParent.set(item.parentId, siblings);
  }
  return childrenByParent;
}

/**
 * Every descendant of `rootId` within `items` (not including `rootId`
 * itself) — used to keep a parent picker from offering an obviously
 * cyclic choice. The backend (setPageParent) remains the real authority.
 * Generic over `{id, parentId}` — the old per-locale `PageListItem` and
 * the new `PageGroupListItem` both have this exact shape (the hierarchy
 * itself is locale-independent in the new model, see docs/adr on
 * PageGroup, but the walk is the same either way).
 */
export function collectDescendantIds<T extends HierarchyItem>(
  items: T[],
  rootId: string,
): Set<string> {
  const childrenByParent = groupByParent(items);
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

export interface HierarchyNode<T> {
  item: T;
  depth: number;
}

/**
 * Depth-first, indented order (parent immediately followed by its
 * children) for rendering a simple nested list — no virtual root node, no
 * collapse/expand state. An item whose parentId isn't in `items` (e.g.
 * the parent sits on a different page of a paginated result set) is
 * treated as a root rather than dropped — same "5-15 pagine per sito, una
 * pagina di risultati" scale assumption already used elsewhere
 * (PagePickerDialog).
 */
export function buildHierarchyTree<T extends HierarchyItem>(
  items: T[],
): HierarchyNode<T>[] {
  const childrenByParent = groupByParent(items);
  const idsInList = new Set(items.map((item) => item.id));
  const roots = items.filter(
    (item) => !item.parentId || !idsInList.has(item.parentId),
  );

  const result: HierarchyNode<T>[] = [];
  function visit(item: T, depth: number) {
    result.push({ item, depth });
    for (const child of childrenByParent.get(item.id) ?? []) {
      visit(child, depth + 1);
    }
  }
  for (const root of roots) {
    visit(root, 0);
  }
  return result;
}
