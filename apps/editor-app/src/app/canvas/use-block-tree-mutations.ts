import { useState, type Dispatch, type SetStateAction } from 'react';
import type { Block } from '@brisk/shared-types';
import type { BlockDescriptor } from '@brisk/block-registry';
import { renderBlockFragment } from '../../lib/block-fragment-api-client.js';
import type { PreviewBridgeState } from './use-preview-bridge.js';
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
} from './use-block-tree.js';

/** Alla radice se il blocco selezionato non è un contenitore, altrimenti in coda ai suoi figli — regola "contenitore selezionato o radice" del piano dell'editor visuale, Giorno 3. */
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
 * Un'azione annullabile — `before`/`after` per il ripristino dello stato
 * locale (identico per ogni tipo di mutazione), `syncForward`/`syncBackward`
 * per rifare/disfare il suo EFFETTO SUL CANVAS LIVE, specifico per tipo:
 * un inserimento si disfa rimuovendo, una rimozione si disfa reinserendo,
 * uno spostamento si disfa spostando all'indice opposto — le tre primitive
 * del bridge (`insertBlock`/`removeBlock`/`reorderBlocks`+`patchBlock`) non
 * sono simmetriche tra loro, quindi non esiste un solo "contrario
 * generico": ogni handler sotto costruisce la propria coppia.
 */
interface HistoryEntry {
  before: Block[];
  after: Block[];
  syncForward: () => void;
  syncBackward: () => void;
}

/** Storico limitato — un editor di contenuti non ha bisogno di un undo illimitato, e uno stack che cresce all'infinito in una sessione lunga è comunque uno spreco. */
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
  handleReorderRoot: (orderedIds: string[]) => void;
  handleRemoveSelected: () => void;
  handleMoveSelected: (direction: -1 | 1) => void;
  handleDuplicateSelected: () => void;
  handleAddChild: () => void;
  handleInsertAtRoot: (descriptor: BlockDescriptor, offset: 0 | 1) => void;
  /** Riusata da use-sidebar-drag.ts per un drop su un punto arbitrario del canvas — stesso meccanismo di ogni altro inserimento qui, solo con un target già calcolato dal chiamante invece che da resolveInsertTarget/una posizione selezionata. */
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
 * Sposta/duplica/elimina/inserisci un blocco — il pezzo più intrecciato dei
 * tre estratti da canvas-editor-shell.tsx (Bridge+token+localBlocks tutti e
 * tre insieme), per questo l'ultimo ad essere isolato e non il primo.
 * `performInsert` sotto è il nucleo comune riusato da OGNI handler che
 * inserisce un blocco (prima 4 copie quasi identiche di insertBlock+
 * applyLocalChange+insertIntoCanvas nel file originale). Ospita anche
 * l'undo/redo (pattern command, una entry esplicita per mutazione): è
 * l'unico posto che già vede OGNI mutazione strutturale dell'albero, quindi
 * il punto naturale per intercettarle invece di un quarto hook a parte.
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

  /** Registra una nuova azione — cancella sempre il "future" (ripetere non ha più senso dopo una mutazione nuova, stessa convenzione di ogni editor con undo/redo). */
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
   * Rigenera e ripatcha per intero un blocco-contenitore (stesso
   * `editor:patch-block` di un cambio proprietà) dopo che uno dei suoi
   * figli è stato inserito/rimosso — non basta inserire/rimuovere SOLO quel
   * figlio nel DOM: l'euristica di risoluzione del contenitore in
   * preview-bridge-client.ts assume che `<slot/>` sia l'unico contenuto
   * dell'elemento radice del blocco-contenitore, falsa per Testimonials
   * (pulsanti di navigazione + segnaposto "contenitore vuoto" attorno allo
   * slot) e fragile in generale per qualunque "cornice" che dipenda dalla
   * presenza di figli. `treeWithUpdatedChildren` è l'albero già ricalcolato
   * dal chiamante DOPO la modifica (a differenza di `localBlocks`, che
   * resta quello PRIMA finché serve).
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

  /** Nucleo condiviso di ogni inserimento a livello radice: renderizza il frammento e chiede al bridge di innestarlo in un punto ESPLICITO (nessuna ricomputazione di `beforeBlockId` da uno stato "corrente" che potrebbe non essere più quello giusto per un redo successivo — vedi handleRemoveSelected's syncBackward per il caso in cui questo conta davvero). */
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
      // Il blocco resta comunque nell'albero locale e nella bozza salvata
      // (applyLocalChange è già avvenuto) — ricomparirà nel canvas al
      // prossimo reload dell'iframe, stesso comportamento di oggi per
      // qualunque fallimento di rete.
    }
  }

  /**
   * Renderizza il frammento del blocco APPENA creato (mai visto prima
   * dall'iframe, a differenza di usePropertyPatch che ne sostituisce uno
   * esistente) e lo inserisce nel canvas via `editor:insert-block` — senza
   * questo, il blocco resterebbe nell'albero locale/nella bozza salvata ma
   * invisibile finché l'iframe non si ricarica (il bug segnalato). I
   * `children` del blocco sono già noti qui (appena costruiti o clonati),
   * niente bisogno che il server li rilegga dalla bozza salvata — evita
   * anche la race fra salvataggio e lettura per un contenitore.
   * `beforeBlockId` è calcolato PRIMA di applicare l'inserimento
   * all'albero: è l'id di chi oggi occupa la posizione target, che dopo
   * l'inserimento si ritroverà spostato di uno.
   *
   * Per un inserimento ANNIDATO (`target.parentId` non nullo), vedi
   * `patchParentBlock` sopra — si ripatcha il genitore, non si inserisce il
   * figlio da solo.
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

  function handleReorderRoot(orderedIds: string[]): void {
    const before = localBlocks;
    let next = before;
    orderedIds.forEach((id, index) => {
      next = moveBlock(next, id, { parentId: null, index });
    });
    applyLocalChange(next);
    const syncForward = () => bridge.reorderBlocks(null, orderedIds);
    const syncBackward = () =>
      bridge.reorderBlocks(
        null,
        before.map((block) => block.id as string),
      );
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
    // Un blocco annidato rimosso può cambiare la "cornice" del suo
    // genitore (es. Testimonials nasconde di nuovo i pulsanti nav e
    // rimostra il segnaposto vuoto quando perde il suo ultimo figlio) —
    // stesso motivo per cui un inserimento annidato ripatcha il genitore
    // invece di toccare solo il nodo rimosso. Un blocco di primo livello
    // resta invece un semplice editor:remove-block.
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
        // Reinserisce alla posizione ORIGINALE — non riusa insertIntoCanvas
        // (ricomputerebbe beforeBlockId da `localBlocks`, che al momento di
        // un successivo redo non è più `before`): il vero fratello
        // successivo va preso qui, direttamente da `before`, la foto
        // dell'albero al momento della rimozione originale.
        const siblingsBefore = siblingsAt(before, null);
        const beforeBlockId = siblingsBefore[location.index + 1]?.id ?? null;
        void insertBlockIntoCanvasAt(removedBlock, null, beforeBlockId);
      }
    };
    syncForward();
    recordHistory({ before, after: next, syncForward, syncBackward });
  }

  // Sposta su/giù, duplica — funzionano a qualunque livello via
  // `locateBlock`, che trova il vero genitore anche per un blocco
  // annidato.
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
   * "+" dentro a un contenitore-collezione selezionato (Testimonianze,
   * Team, Accordion, ...) — aggiunge un altro figlio del suo UNICO tipo
   * consentito (`allowedChildTypes[0]`) senza aprire il picker: non c'è
   * ambiguità da chiedere, è l'unico tipo sensato per quel contenitore
   * (stessa regola di createBlockFromDescriptor). Il pulsante compare solo
   * quando `descriptor.allowedChildTypes` ha esattamente un elemento (vedi
   * block-toolbar-overlay.tsx's canAddChild), quindi qui la ricerca nel
   * registry non dovrebbe mai fallire — se fallisse comunque (registry
   * disallineato), semplicemente non succede nulla.
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
    handleReorderRoot,
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
