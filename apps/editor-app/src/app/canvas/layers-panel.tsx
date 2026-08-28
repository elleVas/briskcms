import { useState } from 'react';
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

export interface LayersPanelProps {
  blocks: Block[];
  hoveredBlockId: string | null;
  selectedBlockId: string | null;
  /**
   * Chiamato con il nuovo ordine (id dei blocchi di primo livello) dopo un
   * drag completato. Il riordino tra fratelli annidati (dentro un
   * Container/Columns/ecc.) non è ancora cablato qui — resta un TODO
   * separato, non necessario perché il pannello Layers stesso resti "la
   * via sempre affidabile" per il caso comune (vedi il piano dell'editor
   * visuale, Giorno 3: il drag diretto sul canvas copre il resto).
   */
  onReorderRoot?: (orderedIds: string[]) => void;
  /**
   * Seleziona un blocco cliccando direttamente la sua riga — l'unico modo
   * affidabile di selezionare un blocco-contenitore quando un suo figlio
   * lo copre per intero sul canvas (es. una Colonna con dentro una sola
   * Galleria a tutta larghezza: nessun pixel del canvas appartiene più
   * alla Colonna, ogni click lì selezionerebbe sempre la Galleria).
   * Prima di questa prop il pannello Livelli mostrava hover/selezione ma
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

/** Isolata per essere testata senza dover simulare un drag reale di dnd-kit (pointer events + misura del DOM) in jsdom. `null` = drop senza effetto (nessun target, stesso punto, id sconosciuto). */
export function computeReorderedIds(
  ids: string[],
  activeId: string,
  overId: string | null,
): string[] | null {
  if (!overId || activeId === overId) {
    return null;
  }
  const oldIndex = ids.indexOf(activeId);
  const newIndex = ids.indexOf(overId);
  if (oldIndex === -1 || newIndex === -1) {
    return null;
  }
  return arrayMove(ids, oldIndex, newIndex);
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
          {block.children?.map((child, index) => (
            <LayerRow
              key={child.id ?? index}
              block={child}
              hoveredBlockId={hoveredBlockId}
              selectedBlockId={selectedBlockId}
              depth={depth + 1}
              onSelect={onSelect}
              collapsedIds={collapsedIds}
              onToggleCollapsed={onToggleCollapsed}
            />
          ))}
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
 * Albero dei blocchi (vedi il piano dell'editor visuale, Giorno 2/3) — mostra
 * hover/selezione che arrivano dal canvas via usePreviewBridge, e permette
 * di riordinare i blocchi di primo livello via drag-and-drop nel documento
 * del genitore (dnd-kit): sempre affidabile multi-browser, indipendente dal
 * drag diretto sul canvas (cross-iframe, con vincoli nativi diversi da
 * browser a browser).
 */
export function LayersPanel({
  blocks,
  hoveredBlockId,
  selectedBlockId,
  onReorderRoot,
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

  // Blocchi senza id (non dovrebbe succedere dopo il backfill del Giorno 1)
  // non sono ordinabili — esclusi dal drag invece di far crashare l'intero
  // pannello, ma comunque non renderizzati qui: un pannello che mostra un
  // sottoinsieme silenzioso dei blocchi sarebbe peggio di un errore visibile.
  const ids = blocks.map((block) => block.id).filter((id) => id !== undefined);
  const isFullyOrderable = ids.length === blocks.length;

  function handleDragEnd(event: DragEndEvent): void {
    if (!onReorderRoot) {
      return;
    }
    const reordered = computeReorderedIds(
      ids,
      String(event.active.id),
      event.over ? String(event.over.id) : null,
    );
    if (reordered) {
      onReorderRoot(reordered);
    }
  }

  if (!isFullyOrderable) {
    return (
      <ul>
        {blocks.map((block, index) => (
          <LayerRow
            key={block.id ?? index}
            block={block}
            hoveredBlockId={hoveredBlockId}
            selectedBlockId={selectedBlockId}
            depth={0}
            onSelect={onSelect}
            collapsedIds={collapsedIds}
            onToggleCollapsed={toggleCollapsed}
          />
        ))}
      </ul>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul>
          {blocks.map((block) => (
            <SortableLayerRow
              key={block.id}
              id={block.id as string}
              block={block}
              hoveredBlockId={hoveredBlockId}
              selectedBlockId={selectedBlockId}
              depth={0}
              onSelect={onSelect}
              collapsedIds={collapsedIds}
              onToggleCollapsed={toggleCollapsed}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
