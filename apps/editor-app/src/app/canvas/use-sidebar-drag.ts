import { useState } from 'react';
import type { Block } from '@brisk/shared-types';
import type { BlockDescriptor } from '@brisk/block-registry';
import {
  computeDropTarget,
  findContainerAtPoint,
  type DropCandidateRect,
} from './compute-drop-target';
import type { IframeGeometry } from './overlay-layer';
import { findBlockInTree, type BlockTreeTarget } from './use-block-tree';

export interface SidebarDragState {
  descriptor: BlockDescriptor;
  pointerX: number;
  pointerY: number;
}

export interface UseSidebarDragParams {
  localBlocks: Block[];
  registry: BlockDescriptor[];
  iframeGeometry: IframeGeometry;
  /** The rects of top-level blocks, the same array the caller already computed for native canvas reordering — this avoids recomputing it a second time here. */
  rootRects: DropCandidateRect[];
  blockRects: {
    id: string;
    top: number;
    left: number;
    width: number;
    height: number;
  }[];
  /** From use-block-tree-mutations.ts — the same mechanism as every other insert, with a target computed here rather than from a selected position. */
  insertNewBlockAt: (
    descriptor: BlockDescriptor,
    target: BlockTreeTarget,
  ) => void;
}

export interface UseSidebarDragResult {
  sidebarDrag: SidebarDragState | null;
  handleSidebarDragStart: (descriptor: BlockDescriptor) => void;
  handleSidebarDragMove: (pageX: number, pageY: number) => void;
  handleSidebarDragEnd: (
    descriptor: BlockDescriptor,
    pageX: number,
    pageY: number,
  ) => void;
}

/**
 * Dragging a NEW block from the sidebar (BlockPicker) onto the canvas —
 * unlike `bridge.activeDrag` (reordering a block that already exists,
 * tracked by the iframe), this drag originates in the parent itself, so its
 * state lives here rather than in the bridge. `pointer` is page-relative
 * (the pointer's native coordinates in the parent's document) and has to be
 * converted to iframe-relative coordinates before reusing
 * compute-drop-target.ts (which expects the same unit as
 * bridge.blockRects).
 */
export function useSidebarDrag({
  localBlocks,
  registry,
  iframeGeometry,
  rootRects,
  blockRects,
  insertNewBlockAt,
}: UseSidebarDragParams): UseSidebarDragResult {
  const [sidebarDrag, setSidebarDrag] = useState<SidebarDragState | null>(null);

  function handleSidebarDragStart(descriptor: BlockDescriptor): void {
    setSidebarDrag({ descriptor, pointerX: 0, pointerY: 0 });
  }

  function handleSidebarDragMove(pageX: number, pageY: number): void {
    setSidebarDrag((prev) =>
      prev ? { ...prev, pointerX: pageX, pointerY: pageY } : prev,
    );
  }

  /**
   * Unlike click-to-insert (resolveInsertTarget, based on the SELECTED
   * block), a drag has a real release point — using it to decide the
   * container instead of the selection is what fixed the bug reported from
   * live use: dragging a block onto a container other than the one still
   * selected previously nested it in the latter anyway, not in the one
   * visually under the pointer, producing a layout that looked broken
   * (content and toolbar positioned somewhere other than the real drop).
   * `blockRects` already includes every nested block, not only top-level
   * ones (unlike `rootRects`, which is scoped to sibling reordering) — here
   * it is filtered down to the blocks the registry marks as containers, and
   * then the smallest rect (the deepest container) containing the point is
   * picked.
   */
  function handleSidebarDragEnd(
    descriptor: BlockDescriptor,
    pageX: number,
    pageY: number,
  ): void {
    setSidebarDrag(null);
    const isOverCanvas =
      pageX >= iframeGeometry.left &&
      pageX <= iframeGeometry.left + iframeGeometry.width &&
      pageY >= iframeGeometry.top;
    if (!isOverCanvas) {
      return;
    }
    const iframeX = pageX - iframeGeometry.left;
    const iframeY = pageY - iframeGeometry.top;
    const containerRects = blockRects.filter((rect) => {
      const block = findBlockInTree(localBlocks, rect.id);
      const blockDescriptor = block
        ? registry.find((d) => d.type === block.type)
        : undefined;
      return Boolean(blockDescriptor?.isContainer);
    });
    const hitContainerId = findContainerAtPoint(
      containerRects,
      iframeX,
      iframeY,
    );
    const hitContainer = hitContainerId
      ? findBlockInTree(localBlocks, hitContainerId)
      : null;
    const target: BlockTreeTarget = hitContainer?.id
      ? { parentId: hitContainer.id, index: hitContainer.children?.length ?? 0 }
      : {
          parentId: null,
          index:
            computeDropTarget(rootRects, '', iframeY)?.index ??
            localBlocks.length,
        };
    insertNewBlockAt(descriptor, target);
  }

  return {
    sidebarDrag,
    handleSidebarDragStart,
    handleSidebarDragMove,
    handleSidebarDragEnd,
  };
}
