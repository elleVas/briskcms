import { useEffect, useState } from 'react';
import type { Block } from '@brisk/shared-types';
import {
  computeDropTarget,
  siblingDropRects,
  type DropCandidateRect,
  type DropTarget,
} from './compute-drop-target';
import type { IframeGeometry } from './overlay-layer';
import { blockIds, moveBlock, siblingsAt } from './use-block-tree';
import type { PreviewBridgeState } from './use-preview-bridge';
import type { SidebarDragState } from './use-sidebar-drag';

export interface UseCanvasDragReorderParams {
  localBlocks: Block[];
  bridge: Pick<PreviewBridgeState, 'activeDrag' | 'dragEnded' | 'blockRects'>;
  sidebarDrag: SidebarDragState | null;
  /** The root's drop rects, which the shell already measures for the sidebar drag. */
  rootRects: DropCandidateRect[];
  iframeGeometry: IframeGeometry;
  /** The one implementation of "reorder" — the Layers panel uses it too, so a drop on the canvas gets the same history entry. */
  handleReorder: (parentId: string | null, orderedIds: string[]) => void;
}

/**
 * Reordering by dragging on the canvas itself: where the drop indicator
 * sits while the pointer moves, and the reorder once it is released.
 *
 * Returns the live drop target, `null` when nothing is being dragged.
 */
export function useCanvasDragReorder({
  localBlocks,
  bridge,
  sidebarDrag,
  rootRects,
  iframeGeometry,
  handleReorder,
}: UseCanvasDragReorderParams): DropTarget | null {
  // Purely derived, with no state of its own — it updates on every render
  // alongside `bridge.activeDrag`/`sidebarDrag`, so the indicator follows
  // the pointer without a dedicated effect. A drag out of the sidebar has no
  // block already in the tree to exclude, and no real id can equal '', so
  // every top-level block is a candidate.
  const liveDropTarget = bridge.activeDrag
    ? computeDropTarget(
        siblingDropRects(
          localBlocks,
          bridge.blockRects,
          bridge.activeDrag.blockId,
        ).rects,
        bridge.activeDrag.blockId,
        bridge.activeDrag.pointer.y,
      )
    : sidebarDrag
      ? computeDropTarget(
          rootRects,
          '',
          sidebarDrag.pointerY - iframeGeometry.top,
        )
      : null;

  // Applied once the drag ends, by "adjusting state during render": the
  // optimistic update never lives in an effect (react-hooks/set-state-in-
  // effect). `pendingReorderCommit` is state rather than a ref because a ref
  // cannot be written during render; it carries the freshly reordered ids to
  // the effect below, the one place where calling out to the caller is safe
  // — and that effect never calls setState, it only reads this value.
  const [lastAppliedDragEnd, setLastAppliedDragEnd] = useState(
    bridge.dragEnded,
  );
  // The parent travels with the order: a drop can reorder the children of
  // any container, not just the page's own top level.
  const [pendingReorderCommit, setPendingReorderCommit] = useState<{
    parentId: string | null;
    orderedIds: string[];
  } | null>(null);
  if (bridge.dragEnded !== lastAppliedDragEnd) {
    setLastAppliedDragEnd(bridge.dragEnded);
    if (bridge.dragEnded) {
      const { blockId, pointer } = bridge.dragEnded;
      const { parentId, rects } = siblingDropRects(
        localBlocks,
        bridge.blockRects,
        blockId,
      );
      const dropTarget = computeDropTarget(rects, blockId, pointer.y);
      if (dropTarget) {
        const next = moveBlock(localBlocks, blockId, {
          parentId,
          index: dropTarget.index,
        });
        // Dropped where it already was: no identical draft saved just
        // because moveBlock always returns a new array. Compared among the
        // SIBLINGS, since those are what the drop reordered.
        const before = blockIds(siblingsAt(localBlocks, parentId));
        const after = blockIds(siblingsAt(next, parentId));
        if (before.join() !== after.join()) {
          setPendingReorderCommit({ parentId, orderedIds: after });
        }
      }
    }
  }
  useEffect(() => {
    if (pendingReorderCommit) {
      // Through handleReorder, not around it: a drop on the canvas used to
      // apply and save the move by hand, which left it the only structural
      // mutation with no history entry — undoable from the Layers panel and
      // not from the canvas.
      //
      // Not cleared afterwards, deliberately: every drop stores a brand new
      // object, so identity alone re-runs this, and clearing it would be a
      // setState inside an effect for no gain.
      handleReorder(
        pendingReorderCommit.parentId,
        pendingReorderCommit.orderedIds,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts only to a NEW pendingReorderCommit; handleReorder is recreated every render but reads current state at call time.
  }, [pendingReorderCommit]);

  return liveDropTarget;
}
