import { type ReactNode, useState } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  sortableKeyboardCoordinates,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Block } from '@brisk/shared-types';
import { locateBlock, siblingsAt } from './use-block-tree';

export interface LayersPanelProps {
  blocks: Block[];
  hoveredBlockId: string | null;
  selectedBlockId: string | null;
  /**
   * Chiamato con `(parentId, orderedIds)` dopo un drag completato, a
   * qualunque profondità — `parentId: null` per i fratelli di primo
   * livello, altrimenti l'id del blocco-contenitore i cui figli sono stati
   * riordinati. Ogni riga visibile (root o annidata) condivide lo stesso
   * `SortableContext`; `computeNestedReorder` sotto rifiuta un drop tra
   * fratelli di genitori diversi invece di riparentare — stesso principio
   * di `computeSiblingReorder` (`compute-sibling-reorder.ts`,
   * pages-list-view.tsx) per lo stesso identico problema di lista piatta
   * multi-gruppo.
   */
  onReorder?: (parentId: string | null, orderedIds: string[]) => void;
  /**
   * Seleziona un blocco cliccando direttamente la sua riga — l'unico modo
   * affidabile di selezionare un blocco-contenitore quando un suo figlio
   * lo copre per intero sul canvas (es. una Colonna con dentro una sola
   * Galleria a tutta larghezza: nessun pixel del canvas appartiene più
   * alla Colonna, ogni click lì selezionerebbe sempre la Galleria).
   * Prima di questa prop il pannello Layers mostrava hover/selezione ma
   * non offriva alcun modo di AGIRE su una riga (bug segnalato dal vivo).
   */
  onSelect: (blockId: string) => void;
}

interface LayerRowProps {
  block: Block;
  hoveredBlockId: string | null;
  selectedBlockId: string | null;
  depth: number;
  onSelect: (blockId: string) => void;
  collapsedIds: ReadonlySet<string>;
  onToggleCollapsed: (blockId: string) => void;
}

function rowClassName(isSelected: boolean, isHovered: boolean): string {
  const base = 'w-full cursor-pointer text-left';
  if (isSelected)
    return `${base} rounded bg-primary/10 px-2 py-1 text-sm font-medium`;
  if (isHovered) return `${base} rounded bg-muted px-2 py-1 text-sm`;
  return `${base} px-2 py-1 text-sm text-muted-foreground`;
}

/**
 * Isolata per essere testata senza dover simulare un drag reale di dnd-kit
 * (pointer events + misura del DOM) in jsdom. `null` = drop senza effetto
 * (nessun target, stesso punto, id sconosciuto, O un drop tra fratelli di
 * genitori diversi — riparentare via drag non è supportato, stesso limite
 * di `computeSiblingReorder`). `locateBlock`/`siblingsAt` (già usate da
 * "sposta su/giù"/"duplica" per lo stesso problema) trovano il vero
 * genitore e i veri fratelli a qualunque profondità, root incluso
 * (`parentId: null`).
 */
export function computeNestedReorder(
  blocks: Block[],
  activeId: string,
  overId: string | null,
): { parentId: string | null; orderedIds: string[] } | null {
  if (!overId || activeId === overId) {
    return null;
  }
  const activeLocation = locateBlock(blocks, activeId);
  const overLocation = locateBlock(blocks, overId);
  if (!activeLocation || !overLocation) {
    return null;
  }
  if (activeLocation.parentId !== overLocation.parentId) {
    return null;
  }

  const siblingIds = siblingsAt(blocks, activeLocation.parentId)
    .map((block) => block.id)
    .filter((id): id is string => id !== undefined);
  const oldIndex = siblingIds.indexOf(activeId);
  const newIndex = siblingIds.indexOf(overId);
  if (oldIndex === -1 || newIndex === -1) {
    return null;
  }

  return {
    parentId: activeLocation.parentId,
    orderedIds: arrayMove(siblingIds, oldIndex, newIndex),
  };
}

/**
 * Ogni id visibile (root e annidato, root incluso), rispettando lo stato
 * collassato — un figlio dentro un contenitore collassato non è renderizzato
 * quindi non deve comparire negli `items` del `SortableContext` (dnd-kit si
 * aspetta che ogni id dichiarato corrisponda a un nodo davvero montato). Un
 * blocco senza id è escluso: non c'è nulla su cui `useSortable` possa
 * agganciarsi, la sua riga resta comunque visibile ma non trascinabile (vedi
 * `renderRow`).
 */
function collectSortableIds(
  blocks: Block[],
  collapsedIds: ReadonlySet<string>,
): string[] {
  return blocks.flatMap((block) => {
    if (!block.id) {
      return [];
    }
    const showChildren =
      Boolean(block.children?.length) && !collapsedIds.has(block.id);
    return [
      block.id,
      ...(showChildren
        ? collectSortableIds(block.children ?? [], collapsedIds)
        : []),
    ];
  });
}

function LayerRow({
  block,
  hoveredBlockId,
  selectedBlockId,
  depth,
  onSelect,
  collapsedIds,
  onToggleCollapsed,
}: LayerRowProps) {
  const isSelected = block.id === selectedBlockId;
  const isHovered = block.id === hoveredBlockId;
  const blockId = block.id;
  const hasChildren = Boolean(block.children && block.children.length > 0);
  const isCollapsed = Boolean(blockId && collapsedIds.has(blockId));

  return (
    <li>
      <div className="flex items-center" style={{ paddingLeft: depth * 12 }}>
        {hasChildren ? (
          <button
            type="button"
            aria-label={isCollapsed ? 'Espandi' : 'Comprimi'}
            className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
            onClick={() => blockId && onToggleCollapsed(blockId)}
          >
            {isCollapsed ? (
              <ChevronRight size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}
        <button
          type="button"
          data-testid="layer-row"
          data-block-id={blockId}
          data-state={isSelected ? 'selected' : isHovered ? 'hovered' : 'idle'}
          className={rowClassName(isSelected, isHovered)}
          disabled={!blockId}
          onClick={() => {
            if (blockId) {
              onSelect(blockId);
            }
          }}
        >
          {block.type}
        </button>
      </div>
      {hasChildren && !isCollapsed && (
        <ul>
          {block.children?.map((child, index) =>
            renderRow(
              {
                block: child,
                hoveredBlockId,
                selectedBlockId,
                depth: depth + 1,
                onSelect,
                collapsedIds,
                onToggleCollapsed,
              },
              index,
            ),
          )}
        </ul>
      )}
    </li>
  );
}

interface SortableLayerRowProps extends LayerRowProps {
  id: string;
}

function SortableLayerRow({ id, ...rowProps }: SortableLayerRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
      }}
      {...attributes}
      {...listeners}
    >
      <LayerRow {...rowProps} />
    </div>
  );
}

/**
 * Sceglie tra riga trascinabile e riga semplice in base alla presenza di un
 * id — condiviso dal livello radice (`LayersPanel`) e da ogni livello
 * annidato (`LayerRow`'s stessa funzione), così ogni profondità dell'albero
 * diventa trascinabile allo stesso modo, non solo la radice. `fallbackKey`
 * è l'indice nella lista dei fratelli, usato solo quando il blocco non ha
 * un id (stesso fallback di prima del riordino annidato).
 */
function renderRow(props: LayerRowProps, fallbackKey: number): ReactNode {
  return props.block.id ? (
    <SortableLayerRow key={props.block.id} id={props.block.id} {...props} />
  ) : (
    <LayerRow key={fallbackKey} {...props} />
  );
}

/**
 * Albero dei blocchi (vedi il piano dell'editor visuale, Giorno 2/3) — mostra
 * hover/selezione che arrivano dal canvas via usePreviewBridge, e permette
 * di riordinare i blocchi via drag-and-drop nel documento del genitore
 * (dnd-kit), a QUALUNQUE profondità — root e annidato (dentro un
 * Container/Colonne/ecc.) condividono lo stesso meccanismo, non solo la
 * radice. Sempre affidabile multi-browser, indipendente dal drag diretto
 * sul canvas (cross-iframe, con vincoli nativi diversi da browser a
 * browser).
 */
export function LayersPanel({
  blocks,
  hoveredBlockId,
  selectedBlockId,
  onReorder,
  onSelect,
}: LayersPanelProps) {
  // Espansi di default (nessuna sorpresa per chi già usa il pannello) — un
  // contenitore compare qui solo dopo che l'utente stesso lo comprime,
  // richiesto dal vivo: con molti blocchi annidati l'elenco diventava
  // troppo lungo da scorrere per trovarne uno.
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  function toggleCollapsed(blockId: string): void {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      return next;
    });
  }

  // Senza una soglia di attivazione, dnd-kit cattura il puntatore al primo
  // pointerdown su una riga — ANCHE un semplice click, senza alcun
  // movimento, verrebbe trattato come un possibile inizio di drag,
  // interferendo con l'onClick del bottone-riga (visto dal vivo in un
  // browser reale: il click per selezionare smetteva di funzionare — un
  // test con jsdom non lo rilevava, perché jsdom non replica la stessa
  // cattura del puntatore di un browser vero). Un piccolo scarto di
  // distanza minima (pattern raccomandato da dnd-kit stesso) distingue un
  // click normale da un vero drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // Spazio/Invio per afferrare la riga con il focus, frecce per
    // spostarla, di nuovo Spazio/Invio per rilasciare, Esc per annullare —
    // il pattern da tastiera standard di dnd-kit per una lista ordinabile
    // (chiude il gap segnalato: prima solo il drag col mouse riordinava un
    // blocco annidato qui dentro).
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  if (blocks.length === 0) {
    return null;
  }

  function handleDragEnd(event: DragEndEvent): void {
    if (!onReorder) {
      return;
    }
    const result = computeNestedReorder(
      blocks,
      String(event.active.id),
      event.over ? String(event.over.id) : null,
    );
    if (result) {
      onReorder(result.parentId, result.orderedIds);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={collectSortableIds(blocks, collapsedIds)}
        strategy={verticalListSortingStrategy}
      >
        <ul>
          {blocks.map((block, index) =>
            renderRow(
              {
                block,
                hoveredBlockId,
                selectedBlockId,
                depth: 0,
                onSelect,
                collapsedIds,
                onToggleCollapsed: toggleCollapsed,
              },
              index,
            ),
          )}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
