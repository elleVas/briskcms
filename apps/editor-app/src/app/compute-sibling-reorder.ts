import { arrayMove } from '@dnd-kit/sortable';
import type { PageListItem } from '../lib/pages-api-client';

export interface SiblingReorderResult {
  locale: string;
  parentId: string | null;
  orderedPageIds: string[];
}

/**
 * Isolated for testing without simulating a real dnd-kit drag (pointer
 * events + DOM measurement) in jsdom — same reasoning as
 * canvas/layers-panel.tsx's own computeNestedReorder.
 *
 * The pages list mixes every locale and every depth of the site's page
 * tree in one flat, drag-orderable list — a drop is only ever meaningful
 * within the SAME (locale, parentId) sibling group the backend actually
 * orders (see reorderSiblingPages); a drop across groups is silently
 * rejected (`null`) rather than reparenting or moving across locales,
 * which is what ParentPageSelect is for.
 */
export function computeSiblingReorder(
  pages: PageListItem[],
  activeId: string,
  overId: string | null,
): SiblingReorderResult | null {
  if (!overId || activeId === overId) {
    return null;
  }
  const active = pages.find((page) => page.id === activeId);
  const over = pages.find((page) => page.id === overId);
  if (!active || !over) {
    return null;
  }
  if (active.locale !== over.locale || active.parentId !== over.parentId) {
    return null;
  }

  const siblingIds = pages
    .filter(
      (page) =>
        page.locale === active.locale && page.parentId === active.parentId,
    )
    .map((page) => page.id);
  const oldIndex = siblingIds.indexOf(activeId);
  const newIndex = siblingIds.indexOf(overId);
  if (oldIndex === -1 || newIndex === -1) {
    return null;
  }

  return {
    locale: active.locale,
    parentId: active.parentId,
    orderedPageIds: arrayMove(siblingIds, oldIndex, newIndex),
  };
}
