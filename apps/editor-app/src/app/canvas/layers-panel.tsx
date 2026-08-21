import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
}

interface LayerRowProps {
  block: Block;
  hoveredBlockId: string | null;
  selectedBlockId: string | null;
  depth: number;
}

function rowClassName(isSelected: boolean, isHovered: boolean): string {
  if (isSelected) return 'rounded bg-primary/10 px-2 py-1 text-sm font-medium';
  if (isHovered) return 'rounded bg-muted px-2 py-1 text-sm';
  return 'px-2 py-1 text-sm text-muted-foreground';
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
}: LayerRowProps) {
  const isSelected = block.id === selectedBlockId;
  const isHovered = block.id === hoveredBlockId;

  return (
    <li>
      <div
        data-testid="layer-row"
        data-block-id={block.id}
        data-state={isSelected ? 'selected' : isHovered ? 'hovered' : 'idle'}
        className={rowClassName(isSelected, isHovered)}
        style={{ paddingLeft: depth * 12 + 8 }}
      >
        {block.type}
      </div>
      {block.children && block.children.length > 0 && (
        <ul>
          {block.children.map((child, index) => (
            <LayerRow
              key={child.id ?? index}
              block={child}
              hoveredBlockId={hoveredBlockId}
              selectedBlockId={selectedBlockId}
              depth={depth + 1}
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
}: LayersPanelProps) {
  const sensors = useSensors(useSensor(PointerSensor));

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
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
