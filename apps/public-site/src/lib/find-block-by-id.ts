import type { Block } from '@brisk/shared-types';

/**
 * Cammina `Block[]`/`children` ricorsivamente — usata dalla patch a
 * frammento (render-block-fragment.ts) per recuperare i `children`
 * ESISTENTI di un blocco prima di ricostruirlo con le props nuove: un
 * cambio di proprietà dall'Inspector non tocca mai i figli di un
 * contenitore, quindi vanno preservati, non persi nel frammento
 * ri-renderizzato.
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
