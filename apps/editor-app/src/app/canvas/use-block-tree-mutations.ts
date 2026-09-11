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
  containsSectionInstance,
  hasId,
  insertBlock,
  locateBlock,
  moveBlock,
  nearestTargetThatHolds,
  removeBlock,
  siblingsAt,
  type BlockTreeTarget,
  type IdentifiedBlock,
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

/**
 * Turns for the canvas syncs of ONE history entry: starting a sync makes
 * any earlier one of the same entry stale, and the stale one drops what it
 * was about to graft once its fragment comes back.
 *
 * A sync that renders first and grafts later is not over when it returns.
 * Undo arriving in between removed the blocks, and the fragments still on
 * their way were then inserted anyway: blocks on the canvas that are not in
 * the tree, and after a redo, the same block twice.
 *
 * Per entry and not for the whole history, deliberately: undoing one insert
 * must not cancel a different insert still rendering.
 */
function syncTurns(): () => () => boolean {
  let turn = 0;
  return () => {
    const mine = ++turn;
    return () => turn === mine;
  };
}

const ALWAYS_CURRENT = () => true;

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
  /**
   * Sends the editor's block style sheet again, built from the tree given.
   * A block's own style is a rule keyed by its id, not something its
   * fragment carries, so a copy with a fresh id shows up plain without it.
   */
  refreshStyleSheet?: (blocks: Block[]) => void;
  selectedBlock: Block | null;
  selectedDescriptor: BlockDescriptor | undefined;
}

export interface UseBlockTreeMutationsResult {
  handleInsert: (descriptor: BlockDescriptor) => void;
  /** A whole strip at once — how a template lands on the page (docs/adr/0059). */
  handleInsertBlocks: (blocks: IdentifiedBlock[]) => void;
  /** Inserts a copy beside the selection — see the implementation on why the ids change. */
  handlePaste: (block: Block) => void;
  /** Moves a block under a different parent, keeping its id, style and text. */
  handleReparent: (
    blockId: string,
    parentId: string | null,
    index: number,
  ) => void;
  /** Pastes a whole clipboard in one history entry (Fase 7). */
  handlePasteMany: (blocks: Block[]) => void;
  /** Removes a whole selection in one history entry (Fase 7). */
  handleRemoveMany: (blockIds: string[]) => void;
  /** Duplicates a whole selection in one history entry (Fase 7). */
  handleDuplicateMany: (blockIds: string[]) => void;
  handleReorder: (parentId: string | null, orderedIds: string[]) => void;
  handleRemoveSelected: () => void;
  /** Swaps the selected block for another at the same place — see the implementation. */
  handleReplaceSelected: (replacement: IdentifiedBlock) => void;
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
 * isolated rather than the first. `insertManyAt` below is the shared core
 * reused by EVERY handler that inserts a block (previously four nearly
 * identical copies of insertBlock + applyLocalChange + a canvas insert in
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
  refreshStyleSheet,
  selectedBlock,
  selectedDescriptor,
}: UseBlockTreeMutationsParams): UseBlockTreeMutationsResult {
  /**
   * The stacks themselves live in a ref; the state below only mirrors their
   * sizes for the undo/redo buttons.
   *
   * Undo and redo used to run their side effects inside `setPast`/
   * `setFuture` updaters. React may call an updater twice — StrictMode does,
   * on every update in development — so a redo inserted its blocks twice.
   * Reading the stack from a ref and writing it back is what lets the side
   * effects run once, in the handler.
   */
  const historyRef = useRef<{ past: HistoryEntry[]; future: HistoryEntry[] }>({
    past: [],
    future: [],
  });
  const [historySize, setHistorySize] = useState({ past: 0, future: 0 });
  function setHistory(past: HistoryEntry[], future: HistoryEntry[]): void {
    historyRef.current = { past, future };
    setHistorySize({ past: past.length, future: future.length });
  }
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
    setHistorySize({ past: 0, future: 0 });
  }
  // The stacks and the baseline follow, in an effect because a ref may not
  // be written during render. By the time it runs, the shell's own resync
  // has already put the new page's tree in `localBlocks`, and no undo can
  // have happened in between: that takes a user action.
  useEffect(() => {
    historyRef.current = { past: [], future: [] };
    lastCommittedRef.current = localBlocks;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-baselines on a PAGE change only; localBlocks changes on every edit, and re-running then would defeat the point.
  }, [pageId]);

  /**
   * Every change of the tree goes through here, undo and redo included —
   * which is why the style sheet is refreshed here and not in the handlers
   * that happen to add a styled block: whichever path brings an instance
   * back, its rule comes with it.
   */
  function applyLocalChange(next: Block[]): void {
    setLocalBlocks(next);
    onChange(next);
    refreshStyleSheet?.(next);
  }

  /** Records a new action — always clearing the "future" (redo stops making sense after a fresh mutation, the same convention as every editor with undo/redo). */
  function recordHistory(entry: HistoryEntry): void {
    lastCommittedRef.current = entry.after;
    setHistory(
      [...historyRef.current.past, entry].slice(-MAX_HISTORY_ENTRIES),
      [],
    );
  }

  function undo(): void {
    const { past, future } = historyRef.current;
    const entry = past[past.length - 1];
    if (!entry) {
      return;
    }
    setHistory(past.slice(0, -1), [entry, ...future]);
    lastCommittedRef.current = entry.before;
    applyLocalChange(entry.before);
    entry.syncBackward();
  }

  function redo(): void {
    const { past, future } = historyRef.current;
    const [entry, ...rest] = future;
    if (!entry) {
      return;
    }
    setHistory([...past, entry].slice(-MAX_HISTORY_ENTRIES), rest);
    lastCommittedRef.current = entry.after;
    applyLocalChange(entry.after);
    entry.syncForward();
  }

  /**
   * The HTML of one block as the canvas has to show it: with its variant and
   * its own style class, not only its props. The three places that render a
   * fragment here used to pass props alone, so a container re-rendered
   * after gaining a child, or a block pasted or duplicated, lost its looks
   * until a reload.
   */
  function renderFragmentOf(block: IdentifiedBlock, previewToken: string) {
    return renderBlockFragment({
      pageId,
      ...(fragmentSection ?? {}),
      token: previewToken,
      blockId: block.id,
      blockType: block.type,
      props: block.props,
      children: block.children,
      styleOverride: block.styleOverride,
      variant: block.variant,
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
    isCurrent: () => boolean = ALWAYS_CURRENT,
  ): Promise<void> {
    if (!token) {
      return;
    }
    const parent = findBlockInTree(treeWithUpdatedChildren, parentId);
    if (!hasId(parent)) {
      return;
    }
    if (needsReload([parent])) {
      reloadCanvas?.();
      return;
    }
    try {
      const html = await renderFragmentOf(parent, token);
      if (isCurrent()) {
        bridge.patchBlock(parent.id, html);
      }
    } catch {
      // Resta nell'albero locale/nella bozza salvata, riappare corretto al
      // prossimo reload — stesso comportamento del fallimento di rete negli
      // altri rami sotto.
    }
  }

  /**
   * Whether these blocks can only reach the canvas through a reload.
   *
   * A reusable section's blocks live on the server and are grafted on when
   * the page is read (docs/adr/0059); the fragment endpoint renders the one
   * block it is handed, so a Section inside it — pasted, duplicated, put
   * back by an undo, or sitting in a container being re-rendered — came
   * back as "this section has not been published yet".
   */
  function needsReload(blocks: Block[]): boolean {
    return containsSectionInstance(blocks);
  }

  /** The shared core of every root-level insert: it renders the fragments and asks the bridge to graft them, in order, at an EXPLICIT point (no recomputation of `beforeBlockId` from a "current" state that may no longer be the right one for a later redo — see handleRemoveSelected's syncBackward for the case where this genuinely matters). */
  async function insertBlocksIntoCanvasAt(
    blocks: IdentifiedBlock[],
    parentId: string | null,
    beforeBlockId: string | null,
    isCurrent: () => boolean = ALWAYS_CURRENT,
  ): Promise<void> {
    if (!token) {
      return;
    }
    if (needsReload(blocks)) {
      reloadCanvas?.();
      return;
    }
    // Rendered together, grafted in order and in one go: grafting each as
    // its fragment came back would put them in the order the network chose.
    const rendered = await Promise.allSettled(
      blocks.map((block) => renderFragmentOf(block, token)),
    );
    if (!isCurrent()) {
      return;
    }
    rendered.forEach((result, index) => {
      const { align, styleOverride } = blocks[index];
      if (result.status === 'fulfilled') {
        // What the wrapper around a root block reads: the fragment is the
        // block alone, and the wrapper is built in the iframe.
        bridge.insertBlock(result.value, parentId, beforeBlockId, {
          align,
          styleOverride,
        });
      }
      // A rejected one stays in the local tree and in the saved draft
      // either way (applyLocalChange has already happened) — it will
      // reappear on the canvas at the iframe's next reload, the same
      // behaviour as today for any network failure.
    });
  }

  async function insertBlockIntoCanvasAt(
    block: IdentifiedBlock,
    parentId: string | null,
    beforeBlockId: string | null,
    isCurrent: () => boolean = ALWAYS_CURRENT,
  ): Promise<void> {
    await insertBlocksIntoCanvasAt([block], parentId, beforeBlockId, isCurrent);
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
  function performInsert(
    block: IdentifiedBlock,
    target: BlockTreeTarget,
  ): void {
    insertManyAt([block], target);
  }

  function handleInsert(descriptor: BlockDescriptor): void {
    const target = nearestTargetThatHolds(
      localBlocks,
      registry,
      resolveInsertTarget(localBlocks, registry, bridge.selectedBlockId),
      [descriptor.type],
    );
    performInsert(createBlockFromDescriptor(descriptor, registry), target);
  }

  /**
   * Inserts a whole strip of blocks — how a TEMPLATE arrives (docs/adr/0059).
   *
   * Several blocks go in as ONE operation: they used to be a loop over
   * `performInsert`, and each call read the tree from the render it was
   * created in, so every block after the first started from a tree that
   * never had the ones before it. A template of three blocks landed as its
   * last block alone — and cost three undos to take back. The same trap
   * `handlePasteMany` documents, and now the same fix.
   *
   * The strip travels together, so it goes where EVERY block in it may sit
   * — not split between a container and the level above it.
   */
  function handleInsertBlocks(blocks: IdentifiedBlock[]): void {
    if (blocks.length === 0) {
      return;
    }
    const target = nearestTargetThatHolds(
      localBlocks,
      registry,
      resolveInsertTarget(localBlocks, registry, bridge.selectedBlockId),
      blocks.map((block) => block.type),
    );
    insertManyAt(blocks, target);
  }

  /**
   * Blocks inserted side by side as one action — one tree write, one save,
   * one undo — built in a loop over the same growing tree rather than over
   * the render's own copy, which is the whole point. One block is simply
   * the shortest strip: every insert in this file ends up here.
   *
   * Patched into the canvas in place. A strip used to reload the iframe,
   * which threw the page back to the top and could show the draft from
   * before the insert if its save had not landed yet.
   *
   * `beforeBlockId` is the id of whoever occupies the target position
   * today, taken from `before` once: every block is grafted in front of
   * that same one, so a later redo does not recompute it from a tree that
   * has moved on. For a NESTED insert see `patchParentBlock` — the parent
   * is re-rendered, the children are not inserted on their own.
   */
  function insertManyAt(
    blocks: IdentifiedBlock[],
    target: BlockTreeTarget,
  ): void {
    const before = localBlocks;
    let next = before;
    let index = target.index;
    for (const block of blocks) {
      next = insertBlock(next, block, { parentId: target.parentId, index });
      // Forwards, so the strip lands in the order it was written.
      index += 1;
    }
    applyLocalChange(next);
    const parentId = target.parentId;
    const beforeBlockId = siblingsAt(before, null)[target.index]?.id ?? null;
    const takeTurn = syncTurns();
    const syncForward = () => {
      const isCurrent = takeTurn();
      void (parentId
        ? patchParentBlock(parentId, next, isCurrent)
        : insertBlocksIntoCanvasAt(blocks, null, beforeBlockId, isCurrent));
    };
    const syncBackward = () => {
      const isCurrent = takeTurn();
      if (parentId) {
        void patchParentBlock(parentId, before, isCurrent);
        return;
      }
      for (const block of blocks) {
        bridge.removeBlock(block.id);
      }
    };
    syncForward();
    recordHistory({ before, after: next, syncForward, syncBackward });
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
    if (!token || !hasId(block)) {
      return;
    }
    void renderFragmentOf(block, token)
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
  function handleReplaceSelected(replacement: IdentifiedBlock): void {
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
    if (!hasId(selectedBlock)) {
      return;
    }
    const location = locateBlock(localBlocks, selectedBlock.id);
    const before = localBlocks;
    const removedBlock = selectedBlock;
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
        // Reinserts at the ORIGINAL position — the next sibling is not
        // recomputed from `localBlocks`, no longer `before` by the time of
        // a later redo: the real next sibling has to be taken here, straight from
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
   * Pastes a whole clipboard beside the selection, in one operation.
   *
   * Not a loop over `handlePaste`: each call reads the tree from the
   * render it was created in, so the second paste would start from a tree
   * that never had the first — last write wins, and one of the two blocks
   * silently disappears. Found by the test, not by reading.
   */
  function handlePasteMany(blocks: Block[]): void {
    if (blocks.length === 0) {
      return;
    }
    if (blocks.length === 1) {
      handlePaste(blocks[0]);
      return;
    }
    const at = selectedBlock?.id
      ? locateBlock(localBlocks, selectedBlock.id)
      : null;
    insertManyAt(
      blocks.map((block) => cloneBlockWithNewIds(block)),
      nearestTargetThatHolds(
        localBlocks,
        registry,
        at
          ? { parentId: at.parentId, index: at.index + 1 }
          : { parentId: null, index: siblingsAt(localBlocks, null).length },
        blocks.map((block) => block.type),
      ),
    );
  }

  /**
   * Removes every selected block in one step (Fase 7).
   *
   * One history entry for the whole set, not one per block: somebody who
   * selected four things and pressed Delete asked for one action, and four
   * undos to get back would be four surprises.
   *
   * A canvas reload rather than four surgical patches: the blocks can sit
   * under different parents, so the patches would be a set of parent
   * re-renders computed from a tree that is changing underneath them.
   */
  function handleRemoveMany(blockIds: string[]): void {
    if (blockIds.length === 0) {
      return;
    }
    // One block keeps the surgical path — it is the common case, and
    // reloading the canvas for it would be a visible flash where there
    // never used to be one.
    if (blockIds.length === 1 && blockIds[0] === selectedBlock?.id) {
      handleRemoveSelected();
      return;
    }
    const before = localBlocks;
    const next = blockIds.reduce(
      (tree, blockId) => removeBlock(tree, blockId),
      before,
    );
    applyLocalChange(next);
    const sync = () => reloadCanvas?.();
    sync();
    recordHistory({
      before,
      after: next,
      syncForward: sync,
      syncBackward: sync,
    });
  }

  /**
   * Duplicates every selected block, each right after itself. Same
   * single-entry, single-reload reasoning as `handleRemoveMany`.
   */
  function handleDuplicateMany(blockIds: string[]): void {
    if (blockIds.length <= 1) {
      handleDuplicateSelected();
      return;
    }
    const before = localBlocks;
    let next = before;
    // Right to left, so an insertion never shifts the index of a block
    // still waiting to be copied.
    const locations = blockIds
      .flatMap((blockId) => {
        const at = locateBlock(before, blockId);
        const block = findBlockInTree(before, blockId);
        return at && block ? [{ at, block }] : [];
      })
      .sort((a, b) => b.at.index - a.at.index);
    for (const { at, block } of locations) {
      next = insertBlock(next, cloneBlockWithNewIds(block), {
        parentId: at.parentId,
        index: at.index + 1,
      });
    }
    applyLocalChange(next);
    const sync = () => reloadCanvas?.();
    sync();
    recordHistory({
      before,
      after: next,
      syncForward: sync,
      syncBackward: sync,
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
    if (!hasId(block) || !from) {
      return;
    }
    const to: BlockTreeTarget = { parentId, index };
    const next = insertBlock(removeBlock(before, blockId), block, to);
    applyLocalChange(next);
    // Both ends of the move have to be re-rendered, and the fragments
    // involved are the two PARENTS rather than the block: a container
    // shows different chrome when it gains or loses a child (an empty-state
    // hint appearing, a collection's arrows), which patching only the moved
    // node would leave stale. At the root there is no parent fragment, so
    // the block itself is removed or grafted in.
    //
    // Each direction takes the block OUT of where it was in the tree it
    // leaves and puts it IN where it is in the tree it arrives at. Undo used
    // to replay the forward steps against the old tree, so a block moved
    // from the root into a container was removed from the canvas instead of
    // coming back.
    const move =
      (
        out: { parentId: string | null },
        into: BlockTreeTarget,
        arrivingTree: Block[],
      ) =>
      () => {
        if (out.parentId) {
          void patchParentBlock(out.parentId, arrivingTree);
        } else {
          bridge.removeBlock(blockId);
        }
        if (into.parentId) {
          void patchParentBlock(into.parentId, arrivingTree);
        } else {
          const beforeBlockId =
            siblingsAt(arrivingTree, null)[into.index + 1]?.id ?? null;
          void insertBlockIntoCanvasAt(block, null, beforeBlockId);
        }
      };
    const syncForward = move(from, to, next);
    const syncBackward = move(to, from, before);
    syncForward();
    recordHistory({ before, after: next, syncForward, syncBackward });
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
      nearestTargetThatHolds(
        localBlocks,
        registry,
        location
          ? { parentId: location.parentId, index: location.index + 1 }
          : { parentId: null, index: localBlocks.length },
        [block.type],
      ),
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
    handlePasteMany,
    handleRemoveMany,
    handleDuplicateMany,
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
    canUndo: historySize.past > 0,
    canRedo: historySize.future > 0,
  };
}
