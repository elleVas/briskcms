export interface DropCandidateRect {
  id: string;
  top: number;
  height: number;
}

export interface DropTarget {
  /** Indice in cui inserire il blocco trascinato, già calcolato ESCLUDENDO il blocco stesso dall'elenco — passabile direttamente a `moveBlock`/`insertBlock` (use-block-tree.ts), che rimuove il blocco e poi lo reinserisce in quella posizione. */
  index: number;
  /** Y (stessa unità dei rect in ingresso — iframe-relative) del confine su cui disegnare l'indicatore di drop, sopra il blocco che finirebbe spinto in giù, o subito sotto l'ultimo se si sta rilasciando in coda. */
  indicatorTop: number;
}

/**
 * Riordino diretto sul canvas (Giorno 3/4) — calcola dove cadrebbe il
 * blocco trascinato SE rilasciato ora, dalla sola posizione verticale del
 * puntatore. Confronta il puntatore col PUNTO MEDIO di ogni blocco di
 * primo livello (non col suo bordo superiore): superato il punto medio di
 * un blocco, il drop si sposta oltre quel blocco — stessa euristica
 * "closestCenter" già usata da dnd-kit nel pannello Layers, qui applicata a
 * mano perché il drag stesso non è di dnd-kit (attraversa il confine
 * dell'iframe, vedi PreviewDragStartMessage).
 *
 * Assume `rects` già in ordine documento (top crescente) — vero per
 * costruzione: sono raccolti da `collectBlockElements` nell'iframe via
 * `querySelectorAll`, nello stesso ordine in cui `Block[]` li renderizza.
 *
 * `null` se non resta nessun ALTRO blocco di primo livello con cui
 * confrontarsi (il blocco trascinato è l'unico sulla pagina) — non c'è una
 * posizione di drop sensata da calcolare.
 */
export function computeDropTarget(
  rects: DropCandidateRect[],
  draggedBlockId: string,
  pointerY: number,
): DropTarget | null {
  const others = rects.filter((rect) => rect.id !== draggedBlockId);
  if (others.length === 0) {
    return null;
  }

  let index = 0;
  for (const rect of others) {
    const midpoint = rect.top + rect.height / 2;
    if (pointerY > midpoint) {
      index++;
    } else {
      break;
    }
  }

  const indicatorTop =
    index < others.length
      ? others[index].top
      : others[others.length - 1].top + others[others.length - 1].height;

  return { index, indicatorTop };
}

export interface ContainerHitRect {
  id: string;
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Drop di un blocco NUOVO dalla sidebar (segnalato dal vivo: annidava sempre
 * nel contenitore ancora SELEZIONATO, ignorando il punto di rilascio — se
 * l'utente trascinava sopra un contenitore diverso da quello selezionato in
 * precedenza, il blocco finiva nel posto sbagliato senza alcun segnale
 * visivo del perché). Restituisce l'id del contenitore più profondo (l'area
 * più piccola, tra quelli le cui coordinate contengono il punto) — il
 * chiamante (canvas-editor-shell.tsx) passa solo i rect già filtrati per
 * essere contenitori: questo modulo non conosce il registry dei blocchi.
 * `null` se il punto non cade in nessun contenitore — il chiamante ricade
 * sulla posizione a livello radice via `computeDropTarget` sopra.
 */
export function findContainerAtPoint(
  containerRects: ContainerHitRect[],
  x: number,
  y: number,
): string | null {
  let best: { id: string; area: number } | null = null;
  for (const rect of containerRects) {
    const inside =
      x >= rect.left &&
      x <= rect.left + rect.width &&
      y >= rect.top &&
      y <= rect.top + rect.height;
    if (!inside) {
      continue;
    }
    const area = rect.width * rect.height;
    if (!best || area < best.area) {
      best = { id: rect.id, area };
    }
  }
  return best?.id ?? null;
}
