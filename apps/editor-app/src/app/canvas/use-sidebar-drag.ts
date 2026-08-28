import { useState } from 'react';
import type { Block } from '@brisk/shared-types';
import type { BlockDescriptor } from '@brisk/block-registry';
import {
  computeDropTarget,
  findContainerAtPoint,
  type DropCandidateRect,
} from './compute-drop-target.js';
import type { IframeGeometry } from './overlay-layer.js';
import { findBlockInTree, type BlockTreeTarget } from './use-block-tree.js';

export interface SidebarDragState {
  descriptor: BlockDescriptor;
  pointerX: number;
  pointerY: number;
}

export interface UseSidebarDragParams {
  localBlocks: Block[];
  registry: BlockDescriptor[];
  iframeGeometry: IframeGeometry;
  /** Rect dei blocchi di primo livello, stesso array già calcolato dal chiamante per il riordino nativo sul canvas — evita di ricalcolarlo una seconda volta qui. */
  rootRects: DropCandidateRect[];
  blockRects: {
    id: string;
    top: number;
    left: number;
    width: number;
    height: number;
  }[];
  /** Da use-block-tree-mutations.ts — stesso meccanismo di ogni altro inserimento, con un target già calcolato qui invece che da una posizione selezionata. */
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
 * Drag di un blocco NUOVO dalla sidebar (BlockPicker) verso il canvas —
 * a differenza di `bridge.activeDrag` (riordino di un blocco già
 * esistente, tracciato dall'iframe) qui il drag nasce nel genitore
 * stesso, quindi lo stato vive qui e non nel bridge. `pointer` è
 * page-relative (coordinate native del puntatore nel documento del
 * genitore), va convertito in coordinate iframe-relative prima di
 * riusare compute-drop-target.ts (che si aspetta la stessa unità di
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
   * A differenza del click-to-insert (resolveInsertTarget, basato sul
   * blocco SELEZIONATO), un drag ha un vero punto di rilascio — usarlo per
   * decidere il contenitore invece della selezione era il bug segnalato dal
   * vivo: trascinare un blocco su un contenitore diverso da quello ancora
   * selezionato in precedenza lo annidava comunque in quest'ultimo, non in
   * quello visivamente sotto il puntatore, producendo un layout che sembrava
   * rotto (contenuto/toolbar posizionati altrove rispetto al drop reale).
   * `blockRects` include già ogni blocco annidato, non solo quelli di
   * primo livello (a differenza di `rootRects`, scoped al riordino tra
   * fratelli) — qui si filtra ai soli blocchi che il registry marca come
   * contenitori, poi si sceglie il rect più piccolo (il contenitore più
   * profondo) che contiene il punto.
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
