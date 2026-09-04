import { useState, type Dispatch, type SetStateAction } from 'react';
import type { Block } from '@brisk/shared-types';
import type { BlockDescriptor } from '@brisk/block-registry';
import { renderBlockFragment } from '../../lib/block-fragment-api-client';
import type { PreviewBridgeState } from './use-preview-bridge';
import {
  cloneBlockWithNewIds,
  createBlockFromDescriptor,
  findBlockInTree,
  insertBlock,
  locateBlock,
  moveBlock,
  removeBlock,
  siblingsAt,
  type BlockTreeTarget,
} from './use-block-tree';

/** At the root when the selected block is not a container, otherwise at the end of its children — the "selected container or root" rule from the visual editor plan, Day 3. */
function resolveInsertTarget(
  blocks: Block[],
  registry: BlockDescriptor[],
  selectedBlockId: string | null,
): BlockTreeTarget {
  if (selectedBlockId) {
    const selected = findBlockInTree(blocks, selectedBlockId);
    const descriptor = selected
      ? registry.find((d) => d.type === selected.type)
      : undefined;
    if (selected && descriptor?.isContainer) {
      return {
        parentId: selected.id ?? null,
        index: selected.children?.length ?? 0,
      };
    }
  }
  return { parentId: null, index: blocks.length };
}

/**
 * One undoable action — `before`/`after` for restoring local state
 * (identical for every kind of mutation), `syncForward`/`syncBackward` for
 * redoing/undoing its EFFECT ON THE LIVE CANVAS, which is type-specific: an
 * insert is undone by removing, a removal by reinserting, a move by moving
 * to the opposite index — the bridge's three primitives
 * (`insertBlock`/`removeBlock`/`reorderBlocks`+`patchBlock`) are not
 * symmetric with each other, so there is no single "generic opposite": each
 * handler below builds its own pair.
 */
interface HistoryEntry {
  before: Block[];
  after: Block[];
  syncForward: () => void;
  syncBackward: () => void;
}

/** A bounded history — a content editor does not need unlimited undo, and a stack growing forever through a long session is waste either way. */
const MAX_HISTORY_ENTRIES = 50;

export interface UseBlockTreeMutationsParams {
  localBlocks: Block[];
  setLocalBlocks: Dispatch<SetStateAction<Block[]>>;
  onChange: (blocks: Block[]) => void;
  registry: BlockDescriptor[];
  bridge: Pick<
    PreviewBridgeState,
    | 'selectedBlockId'
    | 'patchBlock'
    | 'insertBlock'
    | 'removeBlock'
    | 'reorderBlocks'
  >;
  token: string | null;
  pageId: string;
  selectedBlock: Block | null;
  selectedDescriptor: BlockDescriptor | undefined;
}

export interface UseBlockTreeMutationsResult {
  handleInsert: (descriptor: BlockDescriptor) => void;
  handleReorder: (parentId: string | null, orderedIds: string[]) => void;
  handleRemoveSelected: () => void;
  handleMoveSelected: (direction: -1 | 1) => void;
  handleDuplicateSelected: () => void;
  handleAddChild: () => void;
  handleInsertAtRoot: (descriptor: BlockDescriptor, offset: 0 | 1) => void;
  /** Reused by use-sidebar-drag.ts for a drop at an arbitrary point on the canvas — the same mechanism as every other insert here, only with a target the caller already computed rather than one from resolveInsertTarget or a selected position. */
  insertNewBlockAt: (
    descriptor: BlockDescriptor,
    target: BlockTreeTarget,
  ) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Move/duplicate/delete/insert a block — the most entangled of the three
 * pieces extracted from canvas-editor-shell.tsx (bridge + token +
 * localBlocks all three at once), which is why it was the last to be
 * isolated rather than the first. `performInsert` below is the shared core
 * reused by EVERY handler that inserts a block (previously four nearly
 * identical copies of insertBlock + applyLocalChange + insertIntoCanvas in
 * the original file). It also hosts undo/redo (a command pattern, one
 * explicit entry per mutation): it is the only place that already sees
 * EVERY structural mutation of the tree, and therefore the natural point to
 * intercept them rather than a fourth separate hook.
 */
export function useBlockTreeMutations({
  localBlocks,
  setLocalBlocks,
  onChange,
  registry,
  bridge,
  token,
  pageId,
  selectedBlock,
  selectedDescriptor,
}: UseBlockTreeMutationsParams): UseBlockTreeMutationsResult {
  const [past, setPast] = useState<HistoryEntry[]>([]);
  const [future, setFuture] = useState<HistoryEntry[]>([]);

  function applyLocalChange(next: Block[]): void {
    setLocalBlocks(next);
    onChange(next);
  }

  /** Records a new action — always clearing the "future" (redo stops making sense after a fresh mutation, the same convention as every editor with undo/redo). */
  function recordHistory(entry: HistoryEntry): void {
    setPast((prev) => [...prev, entry].slice(-MAX_HISTORY_ENTRIES));
    setFuture([]);
  }

  function undo(): void {
    setPast((prev) => {
      if (prev.length === 0) {
        return prev;
      }
      const entry = prev[prev.length - 1];
      setLocalBlocks(entry.before);
      onChange(entry.before);
      entry.syncBackward();
      setFuture((f) => [entry, ...f]);
      return prev.slice(0, -1);
    });
  }

  function redo(): void {
    setFuture((prev) => {
      if (prev.length === 0) {
        return prev;
      }
      const entry = prev[0];
      setLocalBlocks(entry.after);
      onChange(entry.after);
      entry.syncForward();
      setPast((p) => [...p, entry].slice(-MAX_HISTORY_ENTRIES));
      return prev.slice(1);
    });
  }

  /**
   * Regenerates and re-patches a container block in full (the same
   * `editor:patch-block` as a property change) after one of its children was
   * inserted or removed — inserting or removing ONLY that child in the DOM
   * is not enough: the container-resolution heuristic in
   * preview-bridge-client.ts assumes `<slot/>` is the sole content of the
   * container block's root element, which is false for Testimonials
   * (navigation buttons plus an "empty container" placeholder around the
   * slot) and fragile in general for any "chrome" that depends on children
   * being present. `treeWithUpdatedChildren` is the tree the caller already
   * recomputed AFTER the change (unlike `localBlocks`, which stays the one
   * from BEFORE for as long as it is needed).
   */
  async function patchParentBlock(
    parentId: string,
    treeWithUpdatedChildren: Block[],
  ): Promise<void> {
    if (!token) {
      return;
    }
    const parent = findBlockInTree(treeWithUpdatedChildren, parentId);
    if (!parent?.id) {
      return;
    }
    try {
      const html = await renderBlockFragment({
        pageId,
        token,
        blockId: parent.id,
        blockType: parent.type,
        props: parent.props,
        children: parent.children,
      });
      bridge.patchBlock(parent.id, html);
    } catch {
      // Resta nell'albero locale/nella bozza salvata, riappare corretto al
      // prossimo reload — stesso comportamento del fallimento di rete negli
      // altri rami sotto.
    }
  }

  /** The shared core of every root-level insert: it renders the fragment and asks the bridge to graft it at an EXPLICIT point (no recomputation of `beforeBlockId` from a "current" state that may no longer be the right one for a later redo — see handleRemoveSelected's syncBackward for the case where this genuinely matters). */
  async function insertBlockIntoCanvasAt(
    block: Block & { id: string },
    parentId: string | null,
    beforeBlockId: string | null,
  ): Promise<void> {
    if (!token) {
      return;
    }
    try {
      const html = await renderBlockFragment({
        pageId,
        token,
        blockId: block.id,
        blockType: block.type,
        props: block.props,
        children: block.children,
      });
      bridge.insertBlock(html, parentId, beforeBlockId);
    } catch {
      // The block stays in the local tree and in the saved draft either way
      // (applyLocalChange has already happened) — it will reappear on the
      // canvas at the iframe's next reload, the same behaviour as today for
      // any network failure.
    }
  }

  /**
   * Renders the fragment of the block JUST created (never seen before by
   * the iframe, unlike usePropertyPatch, which replaces an existing one)
   * and inserts it into the canvas through `editor:insert-block` — without
   * this, the block would stay in the local tree and the saved draft but
   * remain invisible until the iframe reloaded (the reported bug). The
   * block's `children` are already known here (just built or cloned), so
   * there is no need for the server to read them back from the saved draft
   * — which also avoids the save/read race for a container. `beforeBlockId`
   * is computed BEFORE the insert is applied to the tree: it is the id of
   * whoever occupies the target position today, and who will be shifted by
   * one after the insert.
   *
   * For a NESTED insert (`target.parentId` non-null) see `patchParentBlock`
   * above — the parent is re-patched, the child is not inserted on its own.
   */
  async function insertIntoCanvas(
    block: Block & { id: string },
    target: BlockTreeTarget,
    nextBlocks: Block[],
  ): Promise<void> {
    if (target.parentId !== null) {
      await patchParentBlock(target.parentId, nextBlocks);
      return;
    }
    const siblingsBefore = siblingsAt(localBlocks, target.parentId);
    const beforeBlockId = siblingsBefore[target.index]?.id ?? null;
    await insertBlockIntoCanvasAt(block, target.parentId, beforeBlockId);
  }

  function performInsert(
    block: Block & { id: string },
    target: BlockTreeTarget,
  ): void {
    const before = localBlocks;
    const next = insertBlock(before, block, target);
    applyLocalChange(next);
    const syncForward = () => void insertIntoCanvas(block, target, next);
    const syncBackward = () => {
      if (target.parentId) {
        void patchParentBlock(target.parentId, before);
      } else {
        bridge.removeBlock(block.id);
      }
    };
    syncForward();
    recordHistory({ before, after: next, syncForward, syncBackward });
  }

  function handleInsert(descriptor: BlockDescriptor): void {
    const target = resolveInsertTarget(
      localBlocks,
      registry,
      bridge.selectedBlockId,
    );
    performInsert(createBlockFromDescriptor(descriptor, registry), target);
  }

  /**
   * Reorders siblings at ANY depth — `parentId: null` for the root,
   * otherwise the id of the container block whose children were dragged
   * (see `computeNestedReorder` in layers-panel.tsx, its only caller).
   * `moveBlock` with the same `parentId` for every id already handles both
   * the root and the nested case, so no separate branch is needed here —
   * the same reason `handleMoveSelected` below already works at any depth
   * through `locateBlock`.
   */
  function handleReorder(parentId: string | null, orderedIds: string[]): void {
    const before = localBlocks;
    let next = before;
    orderedIds.forEach((id, index) => {
      next = moveBlock(next, id, { parentId, index });
    });
    applyLocalChange(next);
    const beforeSiblingIds = siblingsAt(before, parentId).map(
      (block) => block.id as string,
    );
    const syncForward = () => bridge.reorderBlocks(parentId, orderedIds);
    const syncBackward = () => bridge.reorderBlocks(parentId, beforeSiblingIds);
    syncForward();
    recordHistory({ before, after: next, syncForward, syncBackward });
  }

  function handleRemoveSelected(): void {
    if (!selectedBlock?.id) {
      return;
    }
    const location = locateBlock(localBlocks, selectedBlock.id);
    const before = localBlocks;
    const removedBlock = selectedBlock as Block & { id: string };
    const next = removeBlock(before, selectedBlock.id);
    applyLocalChange(next);
    // A removed nested block can change its parent's "chrome" (Testimonials
    // hides the nav buttons again and shows the empty placeholder once more
    // when it loses its last child, say) — the same reason a nested insert
    // re-patches the parent rather than touching only the removed node. A
    // top-level block stays a plain editor:remove-block instead.
    const syncForward = () => {
      if (location?.parentId) {
        void patchParentBlock(location.parentId, next);
      } else {
        bridge.removeBlock(removedBlock.id);
      }
    };
    const syncBackward = () => {
      if (!location) {
        return;
      }
      if (location.parentId) {
        void patchParentBlock(location.parentId, before);
      } else {
        // Reinserts at the ORIGINAL position — it does not reuse
        // insertIntoCanvas (which would recompute beforeBlockId from
        // `localBlocks`, no longer `before` by the time of a later redo):
        // the real next sibling has to be taken here, straight from
        // `before`, the snapshot of the tree at the moment of the original
        // removal.
        const siblingsBefore = siblingsAt(before, null);
        const beforeBlockId = siblingsBefore[location.index + 1]?.id ?? null;
        void insertBlockIntoCanvasAt(removedBlock, null, beforeBlockId);
      }
    };
    syncForward();
    recordHistory({ before, after: next, syncForward, syncBackward });
  }

  // Move up/down and duplicate — they work at any level through
  // `locateBlock`, which finds the real parent even for a nested block.
  function handleMoveSelected(direction: -1 | 1): void {
    if (!selectedBlock?.id) {
      return;
    }
    const location = locateBlock(localBlocks, selectedBlock.id);
    if (!location) {
      return;
    }
    const siblings = location.parentId
      ? (findBlockInTree(localBlocks, location.parentId)?.children ?? [])
      : localBlocks;
    const targetIndex = location.index + direction;
    if (targetIndex < 0 || targetIndex >= siblings.length) {
      return;
    }
    const before = localBlocks;
    const next = moveBlock(before, selectedBlock.id, {
      parentId: location.parentId,
      index: targetIndex,
    });
    applyLocalChange(next);
    const syncForward = () => {
      if (location.parentId) {
        void patchParentBlock(location.parentId, next);
      } else {
        bridge.reorderBlocks(
          null,
          next.map((block) => block.id as string),
        );
      }
    };
    const syncBackward = () => {
      if (location.parentId) {
        void patchParentBlock(location.parentId, before);
      } else {
        bridge.reorderBlocks(
          null,
          before.map((block) => block.id as string),
        );
      }
    };
    syncForward();
    recordHistory({ before, after: next, syncForward, syncBackward });
  }

  function handleDuplicateSelected(): void {
    if (!selectedBlock?.id) {
      return;
    }
    const location = locateBlock(localBlocks, selectedBlock.id);
    if (!location) {
      return;
    }
    performInsert(cloneBlockWithNewIds(selectedBlock), {
      parentId: location.parentId,
      index: location.index + 1,
    });
  }

  /**
   * The "+" inside a selected collection container (Testimonials, Team,
   * Accordion, ...) — it adds another child of its ONE allowed type
   * (`allowedChildTypes[0]`) without opening the picker: there is no
   * ambiguity to ask about, that being the only sensible type for that
   * container (the same rule as createBlockFromDescriptor). The button only
   * appears when `descriptor.allowedChildTypes` has exactly one entry (see
   * block-toolbar-overlay.tsx's canAddChild), so the registry lookup here
   * should never fail — and if it somehow did (a registry out of sync),
   * simply nothing happens.
   */
  function handleAddChild(): void {
    if (!selectedBlock?.id || !selectedDescriptor) {
      return;
    }
    const childType = selectedDescriptor.allowedChildTypes?.[0];
    const childDescriptor = childType
      ? registry.find((d) => d.type === childType)
      : undefined;
    if (!childDescriptor) {
      return;
    }
    performInsert(createBlockFromDescriptor(childDescriptor, registry), {
      parentId: selectedBlock.id,
      index: selectedBlock.children?.length ?? 0,
    });
  }

  function handleInsertAtRoot(
    descriptor: BlockDescriptor,
    offset: 0 | 1,
  ): void {
    if (!selectedBlock?.id) {
      return;
    }
    const index = localBlocks.findIndex((b) => b.id === selectedBlock.id);
    if (index === -1) {
      return;
    }
    performInsert(createBlockFromDescriptor(descriptor, registry), {
      parentId: null,
      index: index + offset,
    });
  }

  function insertNewBlockAt(
    descriptor: BlockDescriptor,
    target: BlockTreeTarget,
  ): void {
    performInsert(createBlockFromDescriptor(descriptor, registry), target);
  }

  return {
    handleInsert,
    handleReorder,
    handleRemoveSelected,
    handleMoveSelected,
    handleDuplicateSelected,
    handleAddChild,
    handleInsertAtRoot,
    insertNewBlockAt,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
