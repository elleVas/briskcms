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
  /** When present, every button also becomes draggable onto the canvas — see canvas-editor-shell.tsx for the release-point computation. A plain click (no movement past the threshold) stays `onInsert` as today. */
  drag?: BlockDragHandlers;
}

/** The same threshold and heuristic as preview-bridge-client.ts's reorder drag — a mousedown+mouseup without moving far enough is an ordinary click, not a drag. */
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
 * Click-to-insert into the selected container or at the root (the caller,
 * not yet canvas-editor-shell.tsx, decides the target by passing the result
 * to use-block-tree.ts's insertBlock) — the categories come from
 * @brisk/block-registry's config.ts/layout-config.ts. "Not registered = not
 * droppable": a type that does not appear in `registry` for the current
 * category simply has no button here, with no separate deny-list.
 *
 * Each category is a collapsible accordion (user feedback: with ~7
 * categories and over 40 block types, a flat list without visually distinct
 * headings was unreadable) — all closed by default, and several categories
 * can stay open together (`type="multiple"`).
 *
 * Each block button is also draggable onto the canvas when `drag` is passed
 * (Pointer Capture rather than a real HTML5 drag or document-level
 * listeners: the drag starts OUTSIDE the iframe and has to keep receiving
 * events even while the cursor visually passes over the iframe, which a
 * listener on `document` would not guarantee — ordinary hit-testing would
 * deliver those events to the document inside the iframe, not to the
 * parent).
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
