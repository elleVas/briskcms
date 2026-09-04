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
   * Called with `(parentId, orderedIds)` after a completed drag, at any
   * depth — `parentId: null` for top-level siblings, otherwise the id of
   * the container block whose children were reordered. Every visible row
   * (root or nested) shares the same `SortableContext`;
   * `computeNestedReorder` below rejects a drop between siblings of
   * different parents rather than reparenting — the same principle as
   * `computeSiblingReorder` (`compute-sibling-reorder.ts`,
   * pages-list-view.tsx) for the exact same flat multi-group list problem.
   */
  onReorder?: (parentId: string | null, orderedIds: string[]) => void;
  /**
   * Selects a block by clicking its row directly — the only reliable way to
   * select a container block when one of its children covers it entirely on
   * the canvas (a Column holding a single full-width Gallery, say: no
   * canvas pixel belongs to the Column any more, and every click there
   * would always select the Gallery). Before this prop the Layers panel
   * showed hover and selection but offered no way to ACT on a row (a bug
   * reported from live use).
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
 * Isolated so it can be tested without simulating a real dnd-kit drag
 * (pointer events plus DOM measurement) in jsdom. `null` = a drop with no
 * effect (no target, the same position, an unknown id, OR a drop between
 * siblings of different parents — reparenting by drag is not supported, the
 * same limit as `computeSiblingReorder`). `locateBlock`/`siblingsAt`
 * (already used by move up/down and duplicate for the same problem) find
 * the real parent and the real siblings at any depth, root included
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
 * Every visible id (root and nested, root included), respecting the
 * collapsed state — a child inside a collapsed container is not rendered
 * and so must not appear in the `SortableContext`'s `items` (dnd-kit
 * expects every declared id to correspond to a genuinely mounted node). A
 * block with no id is excluded: there is nothing for `useSortable` to hook
 * onto, and its row stays visible but not draggable (see `renderRow`).
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
 * Picks between a draggable row and a plain one based on whether an id is
 * present — shared by the root level (`LayersPanel`) and every nested level
 * (`LayerRow`'s own call), so every depth of the tree becomes draggable the
 * same way, not just the root. `fallbackKey` is the index in the sibling
 * list, used only when the block has no id (the same fallback as before
 * nested reordering existed).
 */
function renderRow(props: LayerRowProps, fallbackKey: number): ReactNode {
  return props.block.id ? (
    <SortableLayerRow key={props.block.id} id={props.block.id} {...props} />
  ) : (
    <LayerRow key={fallbackKey} {...props} />
  );
}

/**
 * The block tree (see the visual editor plan, Day 2/3) — it shows the hover
 * and selection arriving from the canvas through usePreviewBridge, and lets
 * blocks be reordered by drag-and-drop in the parent's document (dnd-kit),
 * at ANY depth — root and nested (inside a Container/Columns/etc.) share
 * the same mechanism, not just the root. Always reliable across browsers,
 * independently of direct dragging on the canvas (cross-iframe, with native
 * constraints that differ from browser to browser).
 */
export function LayersPanel({
  blocks,
  hoveredBlockId,
  selectedBlockId,
  onReorder,
  onSelect,
}: LayersPanelProps) {
  // Expanded by default (no surprise for anyone already using the panel) —
  // a container only shows up here once the user collapses it themselves,
  // asked for from live use: with many nested blocks the list got too long
  // to scroll through to find one.
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

  // Without an activation threshold, dnd-kit captures the pointer on the
  // first pointerdown on a row — EVEN a plain click, with no movement at
  // all, would be treated as a possible drag start, interfering with the row
  // button's onClick (seen live in a real browser: clicking to select
  // stopped working — a jsdom test did not catch it, because jsdom does not
  // reproduce a real browser's pointer capture). A small minimum-distance
  // threshold (the pattern dnd-kit itself recommends) tells an ordinary
  // click from a real drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // Space/Enter to grab the focused row, arrows to move it, Space/Enter
    // again to drop, Esc to cancel — dnd-kit's standard keyboard pattern
    // for a sortable list (closing the reported gap: before this, only a
    // mouse drag could reorder a nested block in here).
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
