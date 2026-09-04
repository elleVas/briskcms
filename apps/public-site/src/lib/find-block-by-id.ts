import type { Block } from '@brisk/shared-types';

/**
 * Walks `Block[]`/`children` recursively — used by fragment patching
 * (render-block-fragment.ts) to recover a block's EXISTING `children`
 * before rebuilding it with the new props: a property change from the
 * Inspector never touches a container's children, so they have to be
 * preserved rather than lost in the re-rendered fragment.
 */
export function findBlockById(blocks: Block[], id: string): Block | null {
  for (const block of blocks) {
    if (block.id === id) {
      return block;
    }
    if (block.children) {
      const found = findBlockById(block.children, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}
