import type { Block } from '@brisk/shared-types';

export interface BlockTreeTarget {
  /** `null` = alla radice dell'albero (pagina o header/footer). */
  parentId: string | null;
  index: number;
}

/**
 * Mutazioni pure su `Block[]`, tutte indirizzate per id (mai per indice
 * posizionale nell'array, che cambierebbe significato ad ogni riordino) —
 * vedi il piano dell'editor visuale, Giorno 3. Ogni funzione restituisce un
 * albero nuovo; nessuna muta l'input.
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

/** Fonde le nuove props su quelle esistenti — un cambio di proprietà dall'Inspector non tocca mai gli altri campi. */
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

export function removeBlock(blocks: Block[], blockId: string): Block[] {
  return blocks
    .filter((block) => block.id !== blockId)
    .map((block) =>
      block.children
        ? { ...block, children: removeBlock(block.children, blockId) }
        : block,
    );
}

/** `target.parentId` deve già esistere nell'albero (o essere `null` per la radice) — un parentId ignoto lascia l'albero invariato, non lancia. */
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
 * Trova un blocco e restituisce la sua posizione come `BlockTreeTarget` —
 * `parentId: null` se è di primo livello, altrimenti l'id del suo vero
 * genitore nell'albero (serve a "Duplica blocco" per reinserire la copia
 * come fratello, allo stesso livello dell'originale, anche quando quel
 * livello è dentro un Container/Columns). `null` se `id` non esiste
 * nell'albero.
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
 * I fratelli attuali in un punto dell'albero — `null` = la radice,
 * altrimenti i `children` del blocco `parentId` (`[]` se non ha ancora
 * figli, o se `parentId` non esiste). Serve a canvas-editor-shell.tsx per
 * sapere quale blocco finirà SUBITO DOPO un nuovo inserimento (vedi
 * `EditorInsertBlockMessage.beforeBlockId`), prima di applicare l'inserimento
 * stesso all'albero locale.
 */
export function siblingsAt(blocks: Block[], parentId: string | null): Block[] {
  if (parentId === null) {
    return blocks;
  }
  return findBlockInTree(blocks, parentId)?.children ?? [];
}

/**
 * Un clone profondo con id NUOVI su ogni nodo (incluso ogni figlio
 * annidato, ricorsivamente) — mai gli stessi id dell'originale, altrimenti
 * due blocchi diversi condividerebbero lo stesso id nell'albero (patch a
 * frammento/drag/riordino sono tutti indirizzati per id, vedi il piano
 * dell'editor visuale). Le props sono copiate per valore (shallow), non
 * condivise con l'originale.
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
