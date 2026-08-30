import { useRef } from 'react';
import type { BlockDescriptor } from '@brisk/block-registry';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../components/ui/accordion';
import { useTranslation } from '../../lib/use-translation';

export interface BlockPickerCategory {
  title: string;
  types: string[];
}

export interface BlockDragHandlers {
  onDragStart: (descriptor: BlockDescriptor) => void;
  onDragMove: (pageX: number, pageY: number) => void;
  onDragEnd: (
    descriptor: BlockDescriptor,
    pageX: number,
    pageY: number,
  ) => void;
}

export interface BlockPickerProps {
  categories: BlockPickerCategory[];
  registry: BlockDescriptor[];
  onInsert: (descriptor: BlockDescriptor) => void;
  /** Se presente, ogni bottone diventa anche trascinabile sul canvas — vedi canvas-editor-shell.tsx per il calcolo del punto di rilascio. Un click semplice (nessun movimento oltre la soglia) resta `onInsert` come oggi. */
  drag?: BlockDragHandlers;
}

/** Stessa soglia/euristica di preview-bridge-client.ts's drag di riordino — un mousedown+mouseup senza spostarsi abbastanza è un click normale, non un drag. */
const DRAG_START_THRESHOLD_PX = 4;

function DraggableBlockButton({
  descriptor,
  onInsert,
  drag,
}: {
  descriptor: BlockDescriptor;
  onInsert: (descriptor: BlockDescriptor) => void;
  drag?: BlockDragHandlers;
}) {
  const { tLabel } = useTranslation();
  const pendingRef = useRef<{ startX: number; startY: number } | null>(null);
  const isDraggingRef = useRef(false);

  if (!drag) {
    return (
      <button
        type="button"
        onClick={() => onInsert(descriptor)}
        className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted hover:text-foreground"
      >
        {tLabel(descriptor.label)}
      </button>
    );
  }

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    pendingRef.current = { startX: event.clientX, startY: event.clientY };
    isDraggingRef.current = false;
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (!drag) {
      return;
    }
    if (!isDraggingRef.current) {
      const pending = pendingRef.current;
      if (!pending) {
        return;
      }
      const dx = event.clientX - pending.startX;
      const dy = event.clientY - pending.startY;
      if (Math.hypot(dx, dy) < DRAG_START_THRESHOLD_PX) {
        return;
      }
      isDraggingRef.current = true;
      drag.onDragStart(descriptor);
    }
    drag.onDragMove(event.clientX, event.clientY);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    const wasDragging = isDraggingRef.current;
    pendingRef.current = null;
    isDraggingRef.current = false;
    if (wasDragging && drag) {
      drag.onDragEnd(descriptor, event.clientX, event.clientY);
    } else {
      onInsert(descriptor);
    }
  }

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="w-full touch-none rounded px-2 py-1.5 text-left text-sm hover:bg-muted hover:text-foreground"
    >
      {tLabel(descriptor.label)}
    </button>
  );
}

/**
 * Click-per-inserire nel contenitore selezionato o alla radice (il
 * chiamante, non ancora canvas-editor-shell.tsx, decide il target passando
 * il risultato a use-block-tree.ts's insertBlock) — categorie da
 * @brisk/block-registry's config.ts/layout-config.ts. "Non registrato =
 * non droppabile": un tipo che non compare in `registry` per la categoria
 * corrente semplicemente non ha un bottone qui, nessuna deny-list a parte.
 *
 * Ogni categoria è un accordion apribile/chiudibile (feedback utente: con
 * ~7 categorie e oltre 40 tipi di blocco, una lista piatta senza intestazioni
 * visivamente distinte era illeggibile) — tutte chiuse di default, più
 * categorie possono restare aperte insieme (`type="multiple"`).
 *
 * Ogni bottone-blocco è anche trascinabile sul canvas quando `drag` è
 * passato (Pointer Capture invece di un vero drag HTML5 o document-level
 * listeners: il drag nasce FUORI dall'iframe e deve continuare a ricevere
 * eventi anche quando il cursore passa visivamente sopra l'iframe, cosa che
 * un listener su `document` non garantirebbe — hit-testing normale
 * consegnerebbe quegli eventi al documento dentro l'iframe, non al genitore).
 */
export function BlockPicker({
  categories,
  registry,
  onInsert,
  drag,
}: BlockPickerProps) {
  const { tLabel } = useTranslation();
  const nonEmptyCategories = categories
    .map((category) => ({
      ...category,
      descriptors: category.types
        .map((type) => registry.find((block) => block.type === type))
        .filter((descriptor): descriptor is BlockDescriptor => !!descriptor),
    }))
    .filter((category) => category.descriptors.length > 0);

  return (
    <Accordion type="multiple">
      {nonEmptyCategories.map((category) => (
        <AccordionItem key={category.title} value={category.title}>
          <AccordionTrigger>{tLabel(category.title)}</AccordionTrigger>
          <AccordionContent>
            <ul className="flex flex-col gap-0.5">
              {category.descriptors.map((descriptor) => (
                <li key={descriptor.type}>
                  <DraggableBlockButton
                    descriptor={descriptor}
                    onInsert={onInsert}
                    drag={drag}
                  />
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
