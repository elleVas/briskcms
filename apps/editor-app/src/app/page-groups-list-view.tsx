import { useReducer } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
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
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  FolderInput,
  GripVertical,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { PageGroupListItemRecord } from '@brisk/shared-types';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import { computeSiblingReorder } from './compute-sibling-reorder';
import { ConfirmActionDialog } from './confirm-action-dialog';
import { buildHierarchyTree } from './page-hierarchy';
import { IconButton } from './icon-button';
import { MediaPickerProvider } from './media-picker-provider';
import { MoveToCollectionDialog } from './move-to-collection-dialog';
import { NewPageGroupDialog } from './new-page-group-dialog';
import {
  PagesListFilterBar,
  type PagesListFilterValues,
} from './pages-list-filter-bar';
import { PAGE_GROUPS_PAGE_SIZE } from './page-groups-queries';
import { TranslationAvailabilityBadges } from './translation-availability-badges';
import { usePageGroupsList } from './use-page-groups-list';
import { TreeGuides } from './tree-guides';

/**
 * A date the row can show, or the same dash an absent creator gets. A row
 * is not the place to print "Invalid Date" at a person: whatever reached
 * us that we cannot read is, to the reader, simply not there.
 */
function formatListDate(value: string, language: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? EMPTY_CELL
    : date.toLocaleDateString(language);
}

/** What a column with nothing in it shows. */
const EMPTY_CELL = '—';

/** One indent step in the page tree, and the row height its elbows meet. */
const PAGE_INDENT = 20;
const PAGE_ROW_HEIGHT = 48;
/**
 * Where a top-level row starts. It is an inline style, not a padding
 * class, because the indentation is added to it: a `px-4` would be
 * overridden by the inline `paddingLeft` and the root pages would sit
 * flat against the list's border.
 */
const PAGE_ROW_INSET = 16;
/**
 * The columns to the right of the title, each a fixed width so a row and
 * the header above it line up without a table element (the rows are also
 * a drag-reorder list and a tree, which a <table> makes harder, not
 * easier). Author and date hide on a narrow window rather than squeezing
 * the title they qualify.
 */
const LOCALES_COLUMN = 'w-28';
/**
 * What is online, in a word.
 *
 * The row said it in colour alone: an amber badge meant "published, and the
 * draft has moved on", and nothing on the screen said so — no legend, no
 * column, no heading. You knew it only if you already knew it.
 */
const STATUS_COLUMN = 'hidden w-44 md:block';
const AUTHOR_COLUMN = 'hidden w-36 xl:block';
const EDITOR_COLUMN = 'hidden w-36 lg:block';
const UPDATED_COLUMN = 'hidden w-24 lg:block';
/** Reserved for the row actions, shown or not, so selecting never shifts the layout. */
const ACTIONS_COLUMN = 'w-[7.5rem]';

export interface PageGroupsListViewProps {
  siteId: string;
  /**
   * `tree` is the site's own pages, in the order somebody dragged them
   * into; `feed` is a collection, flat and newest first. The rows are the
   * same rows — what changes is that a feed has no hierarchy to draw and
   * no order to drag, because its order is the publication date.
   */
  layout?: 'tree' | 'feed';
  /** The collection being listed, so a page created here is created in it. */
  collectionId?: string | null;
  /** Shown as the screen's heading — a collection is named by whoever made it. */
  title?: string;
  defaultLocale: string;
  enabledLocales: string[];
  groups: PageGroupListItemRecord[];
  page: number;
  total: number;
  filters: PagesListFilterValues;
  onFiltersChange: (next: PagesListFilterValues) => void;
}

type DialogKind = 'new' | 'delete' | 'move';

interface PageGroupsListState {
  selectedGroupId: string | null;
  openDialog: DialogKind | 'none';
  actionError: string;
}

const initialState: PageGroupsListState = {
  selectedGroupId: null,
  openDialog: 'none',
  actionError: '',
};

type PageGroupsListAction =
  | { type: 'TOGGLE_SELECTED'; groupId: string }
  | { type: 'OPEN_DIALOG'; dialog: DialogKind }
  | { type: 'CLOSE_DIALOG' }
  | { type: 'SET_ERROR'; error: string };

// Same exclusive-dialog-state discipline as pages-list-view.tsx's own
// reducer, same reason: a single `openDialog` makes "delete dialog stuck
// open for the wrong row" structurally impossible.
function pageGroupsListReducer(
  state: PageGroupsListState,
  action: PageGroupsListAction,
): PageGroupsListState {
  switch (action.type) {
    case 'TOGGLE_SELECTED':
      return {
        selectedGroupId:
          state.selectedGroupId === action.groupId ? null : action.groupId,
        openDialog: 'none',
        actionError: '',
      };
    case 'OPEN_DIALOG':
      return { ...state, openDialog: action.dialog };
    case 'CLOSE_DIALOG':
      return { ...state, openDialog: 'none' };
    case 'SET_ERROR':
      return { ...state, actionError: action.error };
  }
}

/** The default-locale translation's title, falling back to the first available one, then the group id — a group is never created without at least one translation, but a defensive fallback costs nothing. */
function groupDisplayTitle(
  group: PageGroupListItemRecord,
  defaultLocale: string,
): string {
  return preferredTranslation(group, defaultLocale)?.title || group.id;
}

/**
 * The page's state, read off the translation the row is already showing.
 *
 * Deliberately that one and not "any of them": the row's title, address and
 * date all come from the same translation, so a status taken from a
 * different language would be the one line of the row talking about
 * something else.
 */
function groupStatusKey(
  group: PageGroupListItemRecord,
  defaultLocale: string,
):
  | 'pages.list.statusPublished'
  | 'pages.list.statusDraft'
  | 'pages.list.statusPendingShort' {
  const translation = preferredTranslation(group, defaultLocale);
  if (!translation || translation.status !== 'published') {
    return 'pages.list.statusDraft';
  }
  // The SHORT wording. `statusPending` reads "Published, with unpublished
  // changes", which is right for a badge's tooltip ("EN — ...") and, in a
  // column, truncated to "Published, with unpublis…".
  return translation.hasUnpublishedChanges
    ? 'pages.list.statusPendingShort'
    : 'pages.list.statusPublished';
}

/** The site's own language if this page has it, and whatever it does have if not. */
function preferredTranslation(
  group: PageGroupListItemRecord,
  defaultLocale: string,
) {
  return (
    group.translations.find(
      (translation) => translation.locale === defaultLocale,
    ) ?? group.translations[0]
  );
}

interface PageGroupRowProps {
  group: PageGroupListItemRecord;
  depth: number;
  isLast: boolean;
  ancestorIsLast: readonly boolean[];
  isSelected: boolean;
  defaultLocale: string;
  enabledLocales: string[];
  draggable: boolean;
  isDuplicating: boolean;
  /**
   * Whether either author column is being drawn at all. "Created by" and
   * "Last edited by" are "—" on fifteen rows out of sixteen, and between
   * them they took a third of the table to say nothing — so a page of
   * results where nobody is named does not draw them.
   */
  showCreatedBy: boolean;
  showLastEditedBy: boolean;
  onToggleSelected: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onMove: () => void;
  onDelete: () => void;
}

/**
 * The drag handle only renders (and only participates in `useSortable`)
 * when `draggable` — reordering needs the FULL real sibling group
 * server-side (see reorderSiblingPageGroups), so it's disabled whenever
 * the visible `groups` array is a strict subset of that (an active
 * filter, or more than one page of results): a drag under either
 * condition would predictably fail with a permutation-mismatch error.
 */
function PageGroupRow({
  group,
  depth,
  isLast,
  ancestorIsLast,
  isSelected,
  defaultLocale,
  enabledLocales,
  draggable,
  isDuplicating,
  showCreatedBy,
  showLastEditedBy,
  onToggleSelected,
  onEdit,
  onDuplicate,
  onMove,
  onDelete,
}: PageGroupRowProps) {
  const { t, i18n } = useTranslation();
  const translation = preferredTranslation(group, defaultLocale);
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: group.id, disabled: !draggable });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
        paddingLeft: PAGE_ROW_INSET + depth * PAGE_INDENT,
      }}
      className={cn(
        'relative flex items-center gap-2 pr-3',
        // A left rule marks the selected row. The tint alone was doing
        // the whole job, and on a dark list a tint is something you have
        // to look for; the rule is visible without looking.
        'before:absolute before:inset-y-0 before:left-0 before:w-[3px]',
        // The row itself carries the state, not the button inside it: a
        // person clicks anywhere on the line, so the whole line has to
        // answer. Selection used to tint the title alone, which on a
        // dark list is a colour change you have to look for.
        isSelected
          ? 'bg-muted before:bg-primary'
          : 'hover:bg-muted/50 before:bg-transparent',
      )}
    >
      {/* The same guides the canvas Layers panel draws. This list was a
          tree only in the sense that children were indented: at the third
          level, which parent a page belonged to was a guess. */}
      <TreeGuides
        depth={depth}
        isLast={isLast}
        ancestorIsLast={ancestorIsLast}
        indent={PAGE_INDENT}
        rowHeight={PAGE_ROW_HEIGHT}
        offset={PAGE_ROW_INSET}
      />
      {draggable && (
        <button
          type="button"
          aria-label={t('pages.list.dragHandle')}
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>
      )}
      <button
        type="button"
        aria-pressed={isSelected}
        onClick={onToggleSelected}
        className={cn(
          'flex min-h-12 flex-1 cursor-pointer items-center gap-3 py-2 text-left',
          isSelected && 'text-foreground',
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              'truncate text-sm',
              isSelected ? 'font-semibold' : 'font-medium',
            )}
          >
            {groupDisplayTitle(group, defaultLocale)}
          </span>
          {/* The address, under the name it answers to. A page is a title
              AND a URL, and the URL was the half you had to open the page
              to see. */}
          {translation && (
            <span className="truncate font-mono text-xs text-muted-foreground">
              /{translation.slug}
            </span>
          )}
        </span>
        {/* Each in a column of its own, under the header that names it:
            run together after the title, they read as part of it. */}
        <span className={cn('flex shrink-0 justify-start', LOCALES_COLUMN)}>
          <TranslationAvailabilityBadges
            translations={group.translations}
            enabledLocales={enabledLocales}
          />
        </span>
        <span className={cn('truncate text-xs', STATUS_COLUMN)}>
          {t(groupStatusKey(group, defaultLocale))}
        </span>
        {showCreatedBy && (
          <span
            className={cn(
              'truncate text-xs text-muted-foreground',
              AUTHOR_COLUMN,
            )}
          >
            {group.createdByName ?? EMPTY_CELL}
          </span>
        )}
        {showLastEditedBy && (
          <span
            className={cn(
              'truncate text-xs text-muted-foreground',
              EDITOR_COLUMN,
            )}
          >
            {group.lastEditedByName ?? EMPTY_CELL}
          </span>
        )}
        <time
          dateTime={group.lastEditedAt}
          className={cn(
            'text-xs tabular-nums text-muted-foreground',
            UPDATED_COLUMN,
          )}
        >
          {formatListDate(group.lastEditedAt, i18n.language)}
        </time>
      </button>
      {/* The actions belong to the row they act on. Sitting up next to
          the page title, they appeared far from the line that had just
          been clicked, and answered "something is selected" without
          answering "which one". The column is reserved whether or not
          they are shown, so selecting a row never shifts the layout. */}
      <div
        className={cn(
          'flex shrink-0 items-center justify-end gap-1',
          ACTIONS_COLUMN,
        )}
      >
        {isSelected && (
          <>
            <IconButton label={t('pages.list.actions.edit')} onClick={onEdit}>
              <Pencil />
            </IconButton>
            <IconButton
              label={t('pages.list.actions.duplicate')}
              disabled={isDuplicating}
              onClick={onDuplicate}
            >
              <Copy />
            </IconButton>
            <IconButton label={t('pages.list.actions.move')} onClick={onMove}>
              <FolderInput />
            </IconButton>
            <IconButton
              label={t('pages.list.actions.delete')}
              onClick={onDelete}
            >
              <Trash2 />
            </IconButton>
          </>
        )}
      </div>
    </li>
  );
}

/**
 * i18n a livello di campo (see the plan) — pages-list-view.tsx's
 * counterpart for the new PageGroup model: one row per group (not per
 * locale), with per-locale availability badges instead of a single locale
 * badge, plus the filter bar. Drag-reorder and duplicate are wired up
 * (Fase 4's last two tracked follow-ups); creation still only offers a
 * title (no parent picker yet, same reasoning as before).
 */
export function PageGroupsListView({
  siteId,
  layout = 'tree',
  collectionId = null,
  title,
  defaultLocale,
  enabledLocales,
  groups,
  page,
  total,
  filters,
  onFiltersChange,
}: PageGroupsListViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    createPageGroup,
    deletePageGroup,
    duplicatePageGroup,
    isDuplicating,
    moveToCollection,
    isMoving,
    reorderPageGroups,
  } = usePageGroupsList(siteId, defaultLocale, collectionId);
  // A feed has no hierarchy to build: every row sits at depth zero, which
  // is also what makes the tree guides draw nothing.
  const tree =
    layout === 'feed'
      ? groups.map((item) => ({
          item,
          depth: 0,
          isLast: true,
          ancestorIsLast: [] as readonly boolean[],
        }))
      : buildHierarchyTree(groups);

  const [state, dispatch] = useReducer(pageGroupsListReducer, initialState);
  const { selectedGroupId, openDialog, actionError } = state;
  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_GROUPS_PAGE_SIZE));
  const hasNoFilters = Object.values(filters).every((v) => v === '');
  /*
   * Whether either author column has anything to show on THIS page of
   * results. Measured live: one row in sixteen carried a name, and the two
   * columns between them took a third of the width to print an em dash.
   * Per page rather than per site, because that is the question the header
   * is answering — "is there an author to read here".
   */
  const showCreatedBy = groups.some((group) => group.createdByName);
  const showLastEditedBy = groups.some((group) => group.lastEditedByName);
  // A feed is never draggable: its order is the publication date, and a
  // handle offering to change it would be lying.
  const canReorder = layout === 'tree' && hasNoFilters && totalPages <= 1;

  // Same click-vs-drag distinction as canvas/layers-panel.tsx: without an
  // activation distance, dnd-kit would capture the pointer on a plain
  // click too, breaking the row's own select button.
  const dragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function toggleSelected(groupId: string) {
    dispatch({ type: 'TOGGLE_SELECTED', groupId });
  }

  function closeDialog() {
    dispatch({ type: 'CLOSE_DIALOG' });
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!canReorder) return;
    const result = computeSiblingReorder(
      groups,
      String(event.active.id),
      event.over ? String(event.over.id) : null,
    );
    if (result) {
      void reorderPageGroups(result.parentId, result.orderedIds).catch((err) =>
        dispatch({ type: 'SET_ERROR', error: String(err) }),
      );
    }
  }

  async function goToPage(target: number) {
    // Back to the screen this list IS, not to Pages: a collection's own list
    // sent you to the generic page tree as soon as it grew past one page
    // of results, which read as the collection having lost its contents.
    await (collectionId
      ? navigate({
          to: '/collections/$collectionId',
          params: { collectionId },
          search: { page: target },
        })
      : navigate({ to: '/pages', search: { page: target } }));
  }

  async function handleOpenEditor(groupId: string) {
    await navigate({ to: '/page-groups/$groupId', params: { groupId } });
  }

  async function handleDuplicate() {
    if (!selectedGroup) return;
    dispatch({ type: 'SET_ERROR', error: '' });
    try {
      await duplicatePageGroup(selectedGroup.id);
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: String(err) });
    }
  }

  async function handleConfirmDelete() {
    if (!selectedGroup) return;
    dispatch({ type: 'SET_ERROR', error: '' });
    try {
      await deletePageGroup(selectedGroup.id);
      dispatch({ type: 'TOGGLE_SELECTED', groupId: selectedGroup.id });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: String(err) });
    }
  }

  return (
    <MediaPickerProvider siteId={siteId}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">
            {title ?? t('pages.list.title')}
          </h1>
          <Button
            onClick={() => dispatch({ type: 'OPEN_DIALOG', dialog: 'new' })}
          >
            {t('pages.list.newPage')}
          </Button>
        </div>
        <PagesListFilterBar
          value={filters}
          onChange={onFiltersChange}
          enabledLocales={enabledLocales}
        />
        {actionError && (
          <p role="alert" className="text-sm text-destructive">
            {actionError}
          </p>
        )}
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {hasNoFilters ? t('pages.list.empty') : t('pages.list.noMatches')}
          </p>
        ) : (
          <DndContext
            sensors={dragSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={tree.map(({ item }) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              {/* One box around the header and the rows: they are one
                  table, and as two bordered siblings the column names
                  floated a gap away from the first row they named. */}
              <div className="overflow-hidden rounded-md border">
                {/* A header, because the list has columns and was not
                    saying so: a title, a row of language badges, a name
                    and a date read as one crowded line until they were
                    named. */}
                <div className="flex h-9 items-center gap-2 border-b bg-muted/40 pr-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <span
                    className="flex min-w-0 flex-1 gap-3"
                    style={{ paddingLeft: PAGE_ROW_INSET }}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {t('pages.list.colTitle')}
                    </span>
                    <span className={cn('shrink-0', LOCALES_COLUMN)}>
                      {t('pages.list.colLanguages')}
                    </span>
                    <span className={cn('truncate', STATUS_COLUMN)}>
                      {t('pages.list.colStatus')}
                    </span>
                    {showCreatedBy && (
                      <span className={cn('truncate', AUTHOR_COLUMN)}>
                        {t('pages.list.colAuthor')}
                      </span>
                    )}
                    {showLastEditedBy && (
                      <span className={cn('truncate', EDITOR_COLUMN)}>
                        {t('pages.list.colEditor')}
                      </span>
                    )}
                    <span className={cn('truncate', UPDATED_COLUMN)}>
                      {t('pages.list.colUpdated')}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={cn('shrink-0', ACTIONS_COLUMN)}
                  />
                </div>
                <ul className="divide-y">
                  {tree.map(
                    ({ item: group, depth, isLast, ancestorIsLast }) => (
                      <PageGroupRow
                        key={group.id}
                        group={group}
                        depth={depth}
                        isLast={isLast}
                        ancestorIsLast={ancestorIsLast}
                        isSelected={group.id === selectedGroupId}
                        defaultLocale={defaultLocale}
                        enabledLocales={enabledLocales}
                        draggable={canReorder}
                        isDuplicating={isDuplicating}
                        showCreatedBy={showCreatedBy}
                        showLastEditedBy={showLastEditedBy}
                        onToggleSelected={() => toggleSelected(group.id)}
                        onEdit={() => void handleOpenEditor(group.id)}
                        onDuplicate={() => void handleDuplicate()}
                        onMove={() =>
                          dispatch({ type: 'OPEN_DIALOG', dialog: 'move' })
                        }
                        onDelete={() =>
                          dispatch({ type: 'OPEN_DIALOG', dialog: 'delete' })
                        }
                      />
                    ),
                  )}
                </ul>
              </div>
            </SortableContext>
          </DndContext>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <IconButton
              label={t('pages.list.previousPage')}
              disabled={page <= 1}
              onClick={() => void goToPage(page - 1)}
            >
              <ChevronLeft />
            </IconButton>
            <span className="text-sm text-muted-foreground">
              {t('pages.list.pageIndicator', { page, totalPages })}
            </span>
            <IconButton
              label={t('pages.list.nextPage')}
              disabled={page >= totalPages}
              onClick={() => void goToPage(page + 1)}
            >
              <ChevronRight />
            </IconButton>
          </div>
        )}
        <NewPageGroupDialog
          open={openDialog === 'new'}
          onOpenChange={(open) => !open && closeDialog()}
          onCreate={createPageGroup}
        />
        {selectedGroup && (
          <MoveToCollectionDialog
            siteId={siteId}
            open={openDialog === 'move'}
            onOpenChange={(open) => !open && closeDialog()}
            pageTitle={groupDisplayTitle(selectedGroup, defaultLocale)}
            currentCollectionId={selectedGroup.collectionId ?? null}
            onMove={(targetCollectionId) =>
              moveToCollection(selectedGroup.id, targetCollectionId)
            }
            isMoving={isMoving}
          />
        )}
        {selectedGroup && (
          <ConfirmActionDialog
            open={openDialog === 'delete'}
            onOpenChange={(open) => !open && closeDialog()}
            title={t('pages.deleteDialog.title')}
            description={t('pages.deleteDialog.description', {
              name: groupDisplayTitle(selectedGroup, defaultLocale),
            })}
            onConfirm={() => void handleConfirmDelete()}
          />
        )}
      </div>
    </MediaPickerProvider>
  );
}
