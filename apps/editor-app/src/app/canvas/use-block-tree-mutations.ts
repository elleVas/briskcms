import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { Block } from '@brisk/shared-types';
import type { BlockDescriptor } from '@brisk/block-registry';
import { renderBlockFragment } from '../../lib/block-fragment-api-client';
import type { PreviewBridgeState } from './use-preview-bridge';
import {
  cloneBlockWithNewIds,
  createBlockFromDescriptor,
  findBlockInTree,
  blockIds,
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
  /** Set only by the reusable-section editor (docs/adr/0059) — the fragment endpoint then validates the token against the section rather than a page. */
  fragmentSection?: { sectionId: string; locale: string };
  /** Remounts the canvas iframe — used where no fragment can be patched in (docs/adr/0059). */
  reloadCanvas?: () => void;
  selectedBlock: Block | null;
  selectedDescriptor: BlockDescriptor | undefined;
}

export interface UseBlockTreeMutationsResult {
  handleInsert: (descriptor: BlockDescriptor) => void;
  /** A whole strip at once — how a template lands on the page (docs/adr/0059). */
  handleInsertBlocks: (blocks: (Block & { id: string })[]) => void;
  /** Inserts a copy beside the selection — see the implementation on why the ids change. */
  handlePaste: (block: Block) => void;
  /** Moves a block under a different parent, keeping its id, style and text. */
  handleReparent: (
    blockId: string,
    parentId: string | null,
    index: number,
  ) => void;
  handleReorder: (parentId: string | null, orderedIds: string[]) => void;
  handleRemoveSelected: () => void;
  /** Swaps the selected block for another at the same place — see the implementation. */
  handleReplaceSelected: (replacement: Block & { id: string }) => void;
  handleMoveSelected: (direction: -1 | 1) => void;
  handleDuplicateSelected: () => void;
  handleAddChild: () => void;
  handleInsertAtRoot: (descriptor: BlockDescriptor, offset: 0 | 1) => void;
  /** Reused by use-sidebar-drag.ts for a drop at an arbitrary point on the canvas — the same mechanism as every other insert here, only with a target the caller already computed rather than one from resolveInsertTarget or a selected position. */
  insertNewBlockAt: (
    descriptor: BlockDescriptor,
    target: BlockTreeTarget,
  ) => void;
  /**
   * Records an edit that changed a block's props or its per-instance style
   * rather than the shape of the tree — a typed character, a field in the
   * Inspector, a colour in the style popover.
   *
   * Separate from the handlers above because those OWN their mutation: they
   * compute the new tree and apply it. This one is told about a change that
   * already happened elsewhere (canvas-editor-shell.tsx, which owns
   * `localBlocks` for these paths), so it only has to build the entry.
   *
   * The caller decides the boundary, and the boundary is the debounce burst
   * (see usePropertyPatch's onBurstEnd): one entry per run of typing, not
   * one per keystroke, which would make undo useless. It passes only the
   * tree it ended up with — what to go BACK to is `lastCommittedRef`, which
   * the history maintains itself.
   */
  recordEdit: (blockId: string, after: Block[]) => void;
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
  fragmentSection,
  reloadCanvas,
  selectedBlock,
  selectedDescriptor,
}: UseBlockTreeMutationsParams): UseBlockTreeMutationsResult {
  const [past, setPast] = useState<HistoryEntry[]>([]);
  const [future, setFuture] = useState<HistoryEntry[]>([]);
  /**
   * The tree as of the last point the history knows about — the state undo
   * would return to. Every entry below is built from it, which is what
   * lets an edit be recorded when its debounce burst ENDS without anyone
   * having had to snapshot a "before" when the burst opened: the history
   * already knows what came before, and knows it at a moment that does not
   * depend on when a React effect happened to refresh a ref.
   *
   * A ref and not state on purpose: `flushAll` (on publish) can end two
   * bursts in the same tick, and the second has to see the baseline the
   * first just moved. A state update would not have landed yet, and the
   * two entries would overlap.
   */
  const lastCommittedRef = useRef(localBlocks);

  /**
   * The history belongs to ONE page. Nothing reset it before, and the shell
   * does not remount on navigation (it resyncs `localBlocks` from props
   * instead, see its `syncKey`) — so switching language and pressing undo
   * restored the PREVIOUS translation's tree into the current one, and
   * `undo` calls `onChange`, so it was then saved. Silent cross-language
   * content loss.
   */
  const [historyPageId, setHistoryPageId] = useState(pageId);
  if (historyPageId !== pageId) {
    setHistoryPageId(pageId);
    setPast([]);
    setFuture([]);
  }
  // The baseline follows, in an effect because a ref may not be written
  // during render. By the time it runs, the shell's own resync has already
  // put the new page's tree in `localBlocks`.
  useEffect(() => {
    lastCommittedRef.current = localBlocks;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-baselines on a PAGE change only; localBlocks changes on every edit, and re-running then would defeat the point.
  }, [pageId]);

  function applyLocalChange(next: Block[]): void {
    setLocalBlocks(next);
    onChange(next);
  }

  /** Records a new action — always clearing the "future" (redo stops making sense after a fresh mutation, the same convention as every editor with undo/redo). */
  function recordHistory(entry: HistoryEntry): void {
    lastCommittedRef.current = entry.after;
    setPast((prev) => [...prev, entry].slice(-MAX_HISTORY_ENTRIES));
    setFuture([]);
  }

  function undo(): void {
    setPast((prev) => {
      if (prev.length === 0) {
        return prev;
      }
      const entry = prev[prev.length - 1];
      lastCommittedRef.current = entry.before;
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
      lastCommittedRef.current = entry.after;
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
        ...(fragmentSection ?? {}),
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
        ...(fragmentSection ?? {}),
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
   * Inserts a whole strip of blocks — how a TEMPLATE arrives (docs/adr/0059).
   *
   * One at a time through `performInsert`, and forwards rather than
   * backwards: each goes to the position after the one before it, so the
   * strip lands in the order it was written. Reusing the single-block path
   * is what keeps undo, the canvas patch and history working for a
   * template exactly as they do for a block, instead of a second insert
   * path that would have to reimplement all three.
   */
  function handleInsertBlocks(blocks: (Block & { id: string })[]): void {
    let target = resolveInsertTarget(
      localBlocks,
      registry,
      bridge.selectedBlockId,
    );
    for (const block of blocks) {
      performInsert(block, target);
      target = { parentId: target.parentId, index: target.index + 1 };
    }
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
  /**
   * Re-renders one block from the tree given and patches it into the live
   * canvas — the same `editor:patch-block` a property change already sends,
   * only driven by a tree we are moving *to* rather than one the user just
   * typed into. A failure leaves the canvas one step behind visually and
   * loses nothing: `undo` has already restored and saved the real tree.
   */
  function patchBlockFromTree(tree: Block[], blockId: string): void {
    const block = findBlockInTree(tree, blockId);
    // Without a preview token the fragment cannot be rendered — the same
    // guard patchParentBlock makes. Undo still restores and saves the tree;
    // only the live canvas stays behind until the next reload.
    if (!token || !block) {
      return;
    }
    void renderBlockFragment({
      pageId,
      ...(fragmentSection ?? {}),
      token,
      blockId,
      blockType: block.type,
      props: block.props,
      children: block.children,
      styleOverride: block.styleOverride,
      variant: block.variant,
    })
      .then((html) => bridge.patchBlock(blockId, html))
      .catch(() => {
        /* see the comment above — the tree is already correct and saved. */
      });
  }

  function recordEdit(blockId: string, after: Block[]): void {
    const before = lastCommittedRef.current;
    if (before === after) {
      return;
    }
    recordHistory({
      before,
      after,
      syncForward: () => patchBlockFromTree(after, blockId),
      syncBackward: () => patchBlockFromTree(before, blockId),
    });
  }

  function handleReorder(parentId: string | null, orderedIds: string[]): void {
    const before = localBlocks;
    let next = before;
    orderedIds.forEach((id, index) => {
      next = moveBlock(next, id, { parentId, index });
    });
    applyLocalChange(next);
    const beforeSiblingIds = blockIds(siblingsAt(before, parentId));
    const syncForward = () => bridge.reorderBlocks(parentId, orderedIds);
    const syncBackward = () => bridge.reorderBlocks(parentId, beforeSiblingIds);
    syncForward();
    recordHistory({ before, after: next, syncForward, syncBackward });
  }

  /**
   * Swaps the selected block for another one at the same place — how a
   * block becomes a reusable section (docs/adr/0059): the section is
   * created from its content, and the block it was made from is replaced
   * by an instance pointing at it.
   *
   * Remove then insert at the ORIGINAL index, in one history entry: two
   * separate mutations would mean an undo that leaves the page with
   * neither the block nor the section, which is the state nobody asked
   * for.
   */
  function handleReplaceSelected(replacement: Block & { id: string }): void {
    if (!selectedBlock?.id) {
      return;
    }
    const location = locateBlock(localBlocks, selectedBlock.id);
    if (!location) {
      return;
    }
    const before = localBlocks;
    const target: BlockTreeTarget = {
      parentId: location.parentId,
      index: location.index,
    };
    const next = insertBlock(
      removeBlock(before, selectedBlock.id),
      replacement,
      target,
    );
    applyLocalChange(next);
    // A full reload of the canvas rather than a surgical patch: the
    // replacement renders a section, whose blocks the client does not
    // have, so there is no fragment to graft in place of the old node.
    // A full reload rather than a surgical patch, both ways: what replaces
    // the block renders a SECTION, whose blocks live on the server and are
    // resolved at read time — there is no fragment the client could graft
    // in its place.
    const syncForward = () => reloadCanvas?.();
    const syncBackward = () => reloadCanvas?.();
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
        bridge.reorderBlocks(null, blockIds(next));
      }
    };
    const syncBackward = () => {
      if (location.parentId) {
        void patchParentBlock(location.parentId, before);
      } else {
        bridge.reorderBlocks(null, blockIds(before));
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
   * Moves a block under a different parent, keeping the block itself
   * intact (Fase 7).
   *
   * Until now this was impossible: the Layers panel refused a cross-parent
   * drop, so getting a block into a Column meant deleting it and building
   * it again in place — losing its per-instance styling, its variant and
   * its text. This moves the same block, with the same id, so all three
   * survive.
   *
   * One history entry, like the swap in `handleReplaceSelected`: an undo
   * that put the block back but left the hole open would be a state
   * nobody asked for.
   */
  function handleReparent(
    blockId: string,
    parentId: string | null,
    index: number,
  ): void {
    const before = localBlocks;
    const block = findBlockInTree(before, blockId);
    const from = locateBlock(before, blockId);
    if (!block?.id || !from) {
      return;
    }
    const next = insertBlock(
      removeBlock(before, blockId),
      block as Block & { id: string },
      {
        parentId,
        index,
      },
    );
    applyLocalChange(next);
    // Both ends of the move have to be re-rendered, and the fragments
    // involved are the two PARENTS rather than the block: a container
    // shows different chrome when it gains or loses a child (an empty-state
    // hint appearing, a collection's arrows), which patching only the moved
    // node would leave stale.
    const sync = (tree: Block[]) => () => {
      if (from.parentId) {
        void patchParentBlock(from.parentId, tree);
      } else {
        bridge.removeBlock(blockId);
      }
      if (parentId) {
        void patchParentBlock(parentId, tree);
      }
      // Out of a container and back to the root: there is no parent
      // fragment to re-render, so the block is grafted in directly.
      if (!parentId) {
        const siblings = siblingsAt(tree, null);
        const beforeBlockId = siblings[index + 1]?.id ?? null;
        void insertBlockIntoCanvasAt(
          block as Block & { id: string },
          null,
          beforeBlockId,
        );
      }
    };
    sync(next)();
    recordHistory({
      before,
      after: next,
      syncForward: sync(next),
      syncBackward: sync(before),
    });
  }

  /**
   * Pastes a block beside the selected one, or at the end of the page when
   * nothing is selected.
   *
   * Fresh ids on every paste (`cloneBlockWithNewIds`, the same function
   * Duplicate uses): two pastes of one copied block must not share ids,
   * which key the per-instance style rule and the translation overlay —
   * a style set on the second copy would land on both.
   */
  function handlePaste(block: Block): void {
    const location = selectedBlock?.id
      ? locateBlock(localBlocks, selectedBlock.id)
      : null;
    performInsert(
      cloneBlockWithNewIds(block),
      location
        ? { parentId: location.parentId, index: location.index + 1 }
        : { parentId: null, index: localBlocks.length },
    );
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
    recordEdit,
    handleInsert,
    handleInsertBlocks,
    handlePaste,
    handleReparent,
    handleReplaceSelected,
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
