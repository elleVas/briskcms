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
import { headerFooterBlocks, pageBlocks } from '@brisk/block-registry';
import { BlockIcon } from './block-icons';
import { TreeGuides } from '../tree-guides';

import type { Block } from '@brisk/shared-types';
import { useTranslation } from '../../lib/use-translation';
import {
  blockIds,
  findBlockInTree,
  locateBlock,
  siblingsAt,
} from './use-block-tree';

/** One indent step, and the row height the elbow has to meet in the middle of. */
const INDENT = 14;
const ROW_HEIGHT = 22;

/**
 * A block's descriptor by type — for the icon and the name a person
 * recognises. Built once: the registry is static, and this is read for
 * every row of every tree.
 */
const DESCRIPTOR_BY_TYPE = new Map(
  [...pageBlocks, ...headerFooterBlocks].map((block) => [block.type, block]),
);

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
   * Called when a row is dropped onto a DIFFERENT parent — moving a block
   * into or out of a container without deleting and rebuilding it (Fase 7).
   *
   * Before this, `computeNestedReorder` refused a cross-parent drop
   * outright: reparenting was impossible by construction, and the only way
   * to move a block into a Column was to delete it and build it again in
   * place, losing its styling and its text.
   */
  onReparent?: (
    blockId: string,
    parentId: string | null,
    index: number,
  ) => void;
  /**
   * Whether `parentType` may hold `childType`, and whether a type can hold
   * anything at all — the descriptors' own rules (`isContainer` plus
   * `allowedChildTypes`), passed as predicates rather than as the registry
   * itself so this panel keeps knowing nothing about block descriptors.
   */
  canContain?: (parentType: string, childType: string) => boolean;
  isContainerType?: (type: string) => boolean;
  /**
   * Selects a block by clicking its row directly — the only reliable way to
   * select a container block when one of its children covers it entirely on
   * the canvas (a Column holding a single full-width Gallery, say: no
   * canvas pixel belongs to the Column any more, and every click there
   * would always select the Gallery). Before this prop the Layers panel
   * showed hover and selection but offered no way to ACT on a row (a bug
   * reported from live use).
   */
  onSelect: (blockId: string, additive: boolean) => void;
  /** Right-click on a row — the panel selects it first, then asks for a menu here. */
  onContextMenu?: (blockId: string, x: number, y: number) => void;
  /** Every selected id (Fase 7) — `selectedBlockId` is the last of them. */
  selectedBlockIds?: string[];
}

interface LayerRowProps {
  block: Block;
  hoveredBlockId: string | null;
  selectedBlockId: string | null;
  selectedBlockIds: string[];
  depth: number;
  /** Whether this row is the last of its siblings — the line under it stops at its elbow. */
  isLast?: boolean;
  /**
   * For each level above this row, whether the ancestor at that level was
   * the last of its siblings.
   *
   * A tree guide is not just "a line per level": the line under the LAST
   * child has to stop at its elbow, or the tree draws a branch continuing
   * past the point where it ended. Only the row knows its own position;
   * its ancestors' positions have to be handed down.
   */
  ancestorIsLast?: boolean[];
  onSelect: (blockId: string, additive: boolean) => void;
  collapsedIds: ReadonlySet<string>;
  onToggleCollapsed: (blockId: string) => void;
  onContextMenu?: (blockId: string, x: number, y: number) => void;
}

function rowClassName(isSelected: boolean, isHovered: boolean): string {
  // `flex` and not the default block: the row is an icon beside a name,
  // and a <button> lays its children out in a column otherwise.
  const base = 'flex w-full cursor-pointer items-center gap-1.5 text-left';
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

  const siblingIds = blockIds(siblingsAt(blocks, activeLocation.parentId));
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

/** Every id inside `blockId`, itself included — a block cannot be dropped into its own subtree. */
function subtreeIds(blocks: Block[], blockId: string): Set<string> {
  const found = new Set<string>();
  const walk = (candidates: Block[], inside: boolean): void => {
    for (const block of candidates) {
      const isTarget = inside || block.id === blockId;
      if (isTarget && block.id) {
        found.add(block.id);
      }
      if (block.children) {
        walk(block.children, isTarget);
      }
    }
  };
  walk(blocks, false);
  return found;
}

/**
 * Where a cross-parent drop actually lands, or `null` when it must not
 * happen (Fase 7).
 *
 * Dropping ONTO a container's own row means "put it inside", at the end —
 * that is the only way to reach an empty container, which has no child row
 * to aim between. Dropping onto an ordinary row means "become its
 * sibling", at that row's position.
 *
 * Three refusals, and each is a real way to break a page rather than a
 * nicety:
 *  - into its own subtree, which would detach the block from the tree
 *    and lose everything under it;
 *  - into a container that does not accept that type (`canContain`), the
 *    same rule the drag-from-sidebar path already honours;
 *  - a drop whose parent is unchanged, which is a REORDER and belongs to
 *    `computeNestedReorder` — answering it here too would give one gesture
 *    two implementations.
 */
export function computeReparent(
  blocks: Block[],
  activeId: string,
  overId: string | null,
  options: {
    isContainerType: (type: string) => boolean;
    canContain: (parentType: string, childType: string) => boolean;
  },
): { blockId: string; parentId: string | null; index: number } | null {
  if (!overId || activeId === overId) {
    return null;
  }
  const active = findBlockInTree(blocks, activeId);
  const over = findBlockInTree(blocks, overId);
  const activeLocation = locateBlock(blocks, activeId);
  const overLocation = locateBlock(blocks, overId);
  if (!active || !over || !activeLocation || !overLocation) {
    return null;
  }
  if (subtreeIds(blocks, activeId).has(overId)) {
    return null;
  }

  // Onto a container's own row: inside it, at the end.
  if (options.isContainerType(over.type)) {
    if (
      overLocation.parentId === activeId ||
      !options.canContain(over.type, active.type)
    ) {
      return null;
    }
    if (activeLocation.parentId === overId) {
      return null;
    }
    return {
      blockId: activeId,
      parentId: overId,
      index: over.children?.length ?? 0,
    };
  }

  // Onto an ordinary row: beside it.
  if (activeLocation.parentId === overLocation.parentId) {
    return null;
  }
  const newParent = overLocation.parentId
    ? findBlockInTree(blocks, overLocation.parentId)
    : null;
  if (newParent && !options.canContain(newParent.type, active.type)) {
    return null;
  }
  return {
    blockId: activeId,
    parentId: overLocation.parentId,
    index: overLocation.index,
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
  selectedBlockIds,
  depth,
  ancestorIsLast = [],
  isLast = true,
  onSelect,
  onContextMenu,
  collapsedIds,
  onToggleCollapsed,
}: LayerRowProps) {
  // Every selected row looks selected, not only the primary (Fase 7): a
  // multi-selection you cannot see is a multi-selection you will delete by
  // accident.
  const isSelected = Boolean(
    block.id &&
    (block.id === selectedBlockId || selectedBlockIds.includes(block.id)),
  );
  const isHovered = block.id === hoveredBlockId;
  const blockId = block.id;
  const hasChildren = Boolean(block.children && block.children.length > 0);
  const isCollapsed = Boolean(blockId && collapsedIds.has(blockId));
  const { t, tLabel } = useTranslation();

  const descriptor = DESCRIPTOR_BY_TYPE.get(block.type);

  return (
    <li className="relative">
      {/* One guide per level the row sits under, plus the elbow that joins
          this row to its parent. Indentation alone stopped being readable
          at the third level: `Columns > Column > Code` was three rows at
          three margins, and which Column the Code belonged to was a
          guess. The lines answer that without being read. */}
      <TreeGuides
        depth={depth}
        isLast={isLast}
        ancestorIsLast={ancestorIsLast}
        indent={INDENT}
        rowHeight={ROW_HEIGHT}
      />
      <div
        className="flex items-center"
        style={{ paddingLeft: depth * INDENT }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-label={
              isCollapsed
                ? t('canvas.expandChildren')
                : t('canvas.collapseChildren')
            }
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
          onClick={(event) => {
            if (blockId) {
              onSelect(blockId, event.metaKey || event.ctrlKey);
            }
          }}
          onContextMenu={(event) => {
            if (!blockId || !onContextMenu) return;
            event.preventDefault();
            // Selected first, and NOT additively: the menu acts on the
            // selection, so right-clicking one row and deleting must not
            // take whatever was selected before it as well.
            onSelect(blockId, false);
            onContextMenu(blockId, event.clientX, event.clientY);
          }}
        >
          <BlockIcon
            name={descriptor?.icon}
            size={13}
            className="shrink-0 text-muted-foreground"
          />
          {/* The name a person picked this block by, not its type: the
              tree used to read `FeatureGrid` and `EmbedHtml`, which are
              our words for it. Every block already had a translated
              label — the panel simply was not asking for it. */}
          <span className="truncate">
            {descriptor ? tLabel(descriptor.label) : block.type}
          </span>
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
                selectedBlockIds,
                depth: depth + 1,
                ancestorIsLast: [...ancestorIsLast, isLast],
                isLast: index === (block.children?.length ?? 0) - 1,
                onSelect,
                onContextMenu,
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
  selectedBlockIds = [],
  onReparent,
  canContain,
  isContainerType,
  onSelect,
  onContextMenu,
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
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;

    // Reorder first: a drop between siblings of the same parent is the
    // common gesture, and `computeReparent` deliberately refuses it so
    // the two never both answer the same drop.
    const reordered = onReorder
      ? computeNestedReorder(blocks, activeId, overId)
      : null;
    if (reordered) {
      onReorder?.(reordered.parentId, reordered.orderedIds);
      return;
    }
    if (!onReparent || !canContain || !isContainerType) {
      return;
    }
    const reparented = computeReparent(blocks, activeId, overId, {
      isContainerType,
      canContain,
    });
    if (reparented) {
      onReparent(reparented.blockId, reparented.parentId, reparented.index);
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
                selectedBlockIds,
                depth: 0,
                isLast: index === blocks.length - 1,
                onSelect,
                onContextMenu,
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
