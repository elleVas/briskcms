import {
  columnsGridTemplate,
  type Block,
  type BlockStyleOverride,
} from '@brisk/shared-types';
import type { BlockDescriptor } from '@brisk/block-registry';

export interface BlockTreeTarget {
  /** `null` = alla radice dell'albero (pagina o header/footer). */
  parentId: string | null;
  index: number;
}

/**
 * Pure mutations over `Block[]`, all addressed by id (never by positional
 * index in the array, whose meaning would change on every reorder) — see
 * the visual editor plan, Day 3. Every function returns a new tree; none
 * mutates its input.
 */

export function findBlockInTree(blocks: Block[], id: string): Block | null {
  for (const block of blocks) {
    if (block.id === id) {
      return block;
    }
    if (block.children) {
      const found = findBlockInTree(block.children, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

/** Merges the new props over the existing ones — a property change from the Inspector never touches the other fields. */
export function updateBlockProps(
  blocks: Block[],
  blockId: string,
  props: Record<string, unknown>,
): Block[] {
  return blocks.map((block) => {
    if (block.id === blockId) {
      return { ...block, props: { ...block.props, ...props } };
    }
    if (block.children) {
      return {
        ...block,
        children: updateBlockProps(block.children, blockId, props),
      };
    }
    return block;
  });
}

/** Replaces `styleOverride` wholesale (docs/adr/0022) — a single panel edits all of it at once, the same "replaces, does not merge field by field" as Site.updateThemeTokens, not a merge like updateBlockProps above. */
export function updateBlockStyleOverride(
  blocks: Block[],
  blockId: string,
  styleOverride: BlockStyleOverride,
): Block[] {
  return blocks.map((block) => {
    if (block.id === blockId) {
      return { ...block, styleOverride };
    }
    if (block.children) {
      return {
        ...block,
        children: updateBlockStyleOverride(
          block.children,
          blockId,
          styleOverride,
        ),
      };
    }
    return block;
  });
}

export function removeBlock(blocks: Block[], blockId: string): Block[] {
  return blocks
    .filter((block) => block.id !== blockId)
    .map((block) =>
      block.children
        ? { ...block, children: removeBlock(block.children, blockId) }
        : block,
    );
}

/** `target.parentId` has to exist in the tree already (or be `null` for the root) — an unknown parentId leaves the tree unchanged rather than throwing. */
export function insertBlock(
  blocks: Block[],
  newBlock: Block,
  target: BlockTreeTarget,
): Block[] {
  if (target.parentId === null) {
    const next = blocks.slice();
    next.splice(target.index, 0, newBlock);
    return next;
  }
  return blocks.map((block) => {
    if (block.id === target.parentId) {
      const children = block.children ? block.children.slice() : [];
      children.splice(target.index, 0, newBlock);
      return { ...block, children };
    }
    if (block.children) {
      return {
        ...block,
        children: insertBlock(block.children, newBlock, target),
      };
    }
    return block;
  });
}

/**
 * Riordino/spostamento — rimuove il blocco (ovunque sia) e lo reinserisce
 * nella nuova posizione, preservando i suoi `children` esistenti. Un
 * `blockId` ignoto lascia l'albero invariato.
 */
export function moveBlock(
  blocks: Block[],
  blockId: string,
  target: BlockTreeTarget,
): Block[] {
  const block = findBlockInTree(blocks, blockId);
  if (!block) {
    return blocks;
  }
  const withoutBlock = removeBlock(blocks, blockId);
  return insertBlock(withoutBlock, block, target);
}

/**
 * Finds a block and returns its position as a `BlockTreeTarget` —
 * `parentId: null` when it is top-level, otherwise the id of its real
 * parent in the tree (which "Duplicate block" needs in order to reinsert
 * the copy as a sibling, at the same level as the original, even when that
 * level is inside a Container/Columns). `null` when `id` is not in the
 * tree.
 */
export function locateBlock(
  blocks: Block[],
  id: string,
): BlockTreeTarget | null {
  const index = blocks.findIndex((block) => block.id === id);
  if (index !== -1) {
    return { parentId: null, index };
  }
  for (const block of blocks) {
    if (!block.children) {
      continue;
    }
    const found = locateBlock(block.children, id);
    if (found) {
      return found.parentId === null
        ? { parentId: block.id ?? null, index: found.index }
        : found;
    }
  }
  return null;
}

/**
 * The current siblings at a point in the tree — `null` = the root,
 * otherwise block `parentId`'s `children` (`[]` when it has no children
 * yet, or when `parentId` does not exist). canvas-editor-shell.tsx needs it
 * to know which block will end up IMMEDIATELY AFTER a new insert (see
 * `EditorInsertBlockMessage.beforeBlockId`), before applying that insert to
 * the local tree.
 */
export function siblingsAt(blocks: Block[], parentId: string | null): Block[] {
  if (parentId === null) {
    return blocks;
  }
  return findBlockInTree(blocks, parentId)?.children ?? [];
}

/**
 * A deep clone with NEW ids on every node (including every nested child,
 * recursively) — never the original's ids, or two different blocks would
 * share one id in the tree (fragment patching, dragging and reordering are
 * all addressed by id, see the visual editor plan). Props are copied by
 * value (shallow), not shared with the original.
 */
export function cloneBlockWithNewIds(block: Block): Block & { id: string } {
  return {
    ...block,
    id: crypto.randomUUID(),
    props: { ...block.props },
    ...(block.children
      ? { children: block.children.map(cloneBlockWithNewIds) }
      : {}),
  };
}

/**
 * Builds a new block from its descriptor — "seeded" with children where it
 * makes sense to show a real example straight away instead of an empty
 * container (user feedback: an empty collection container with nothing
 * inside is confusing and does not invite building on it). The rule:
 * - Columns starts out with the columns of its own default layout
 *   (`columnsGridTemplate`, the same source of truth as the real CSS grid).
 * - A container with exactly ONE type in `allowedChildTypes`
 *   (Testimonials→Testimonial, Team→Member, Accordion→Question, ...) starts
 *   with ONE child of that type — it is the only sensible type, so there is
 *   no ambiguity to ask the user about.
 * - A generic container (Container/Column, no `allowedChildTypes` — meant
 *   to hold anything) stays empty: there is no "canonical child" to guess,
 *   and it would only show an arbitrary example.
 */
export function createBlockFromDescriptor(
  descriptor: BlockDescriptor,
  registry: BlockDescriptor[],
): Block & { id: string } {
  const block: Block & { id: string } = {
    id: crypto.randomUUID(),
    type: descriptor.type,
    props: descriptor.defaultProps,
  };
  if (!descriptor.isContainer) {
    return block;
  }
  if (descriptor.type === 'Columns') {
    const layout =
      (
        descriptor.defaultProps as {
          layout?: Parameters<typeof columnsGridTemplate>[0];
        }
      ).layout ?? 'two-equal';
    const columnCount = columnsGridTemplate(layout).split(' ').length;
    const columnDescriptor = registry.find((d) => d.type === 'Column');
    return {
      ...block,
      children: columnDescriptor
        ? Array.from({ length: columnCount }, () =>
            createBlockFromDescriptor(columnDescriptor, registry),
          )
        : [],
    };
  }
  if (descriptor.allowedChildTypes?.length === 1) {
    const childDescriptor = registry.find(
      (d) => d.type === descriptor.allowedChildTypes?.[0],
    );
    return {
      ...block,
      children: childDescriptor
        ? [createBlockFromDescriptor(childDescriptor, registry)]
        : [],
    };
  }
  return { ...block, children: [] };
}
