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
import { NewPageGroupDialog } from './new-page-group-dialog';
import {
  PagesListFilterBar,
  type PagesListFilterValues,
} from './pages-list-filter-bar';
import { PAGE_GROUPS_PAGE_SIZE } from './page-groups-queries';
import { TranslationAvailabilityBadges } from './translation-availability-badges';
import { usePageGroupsList } from './use-page-groups-list';

export interface PageGroupsListViewProps {
  siteId: string;
  defaultLocale: string;
  enabledLocales: string[];
  groups: PageGroupListItemRecord[];
  page: number;
  total: number;
  filters: PagesListFilterValues;
  onFiltersChange: (next: PagesListFilterValues) => void;
}

type DialogKind = 'new' | 'delete';

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
  const preferred = group.translations.find(
    (translation) => translation.locale === defaultLocale,
  );
  const fallback = group.translations[0];
  return preferred?.title || fallback?.title || group.id;
}

interface PageGroupRowProps {
  group: PageGroupListItemRecord;
  depth: number;
  isSelected: boolean;
  defaultLocale: string;
  enabledLocales: string[];
  draggable: boolean;
  onToggleSelected: () => void;
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
  isSelected,
  defaultLocale,
  enabledLocales,
  draggable,
  onToggleSelected,
}: PageGroupRowProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: group.id, disabled: !draggable });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
        paddingLeft: depth * 20,
      }}
      className="flex items-center gap-2 px-3"
    >
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
          'flex flex-1 items-center gap-3 py-3 text-left',
          isSelected && 'text-primary',
        )}
      >
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            {groupDisplayTitle(group, defaultLocale)}
          </span>
          {group.createdByName && (
            <span className="text-xs text-muted-foreground">
              {t('pages.list.createdBy', { name: group.createdByName })}
            </span>
          )}
        </div>
        <TranslationAvailabilityBadges
          translations={group.translations}
          enabledLocales={enabledLocales}
        />
      </button>
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
    reorderPageGroups,
  } = usePageGroupsList(siteId, defaultLocale);
  const tree = buildHierarchyTree(groups);

  const [state, dispatch] = useReducer(pageGroupsListReducer, initialState);
  const { selectedGroupId, openDialog, actionError } = state;
  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_GROUPS_PAGE_SIZE));
  const hasNoFilters = Object.values(filters).every((v) => v === '');
  const canReorder = hasNoFilters && totalPages <= 1;

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
    await navigate({ to: '/pages', search: { page: target } });
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
          <h1 className="text-lg font-semibold">{t('pages.list.title')}</h1>
          <div className="flex items-center gap-1">
            {selectedGroup && (
              <>
                <IconButton
                  label={t('pages.list.actions.edit')}
                  onClick={() => void handleOpenEditor(selectedGroup.id)}
                >
                  <Pencil />
                </IconButton>
                <IconButton
                  label={t('pages.list.actions.duplicate')}
                  disabled={isDuplicating}
                  onClick={() => void handleDuplicate()}
                >
                  <Copy />
                </IconButton>
                <IconButton
                  label={t('pages.list.actions.delete')}
                  onClick={() =>
                    dispatch({ type: 'OPEN_DIALOG', dialog: 'delete' })
                  }
                >
                  <Trash2 />
                </IconButton>
              </>
            )}
            <Button
              onClick={() => dispatch({ type: 'OPEN_DIALOG', dialog: 'new' })}
            >
              {t('pages.list.newPage')}
            </Button>
          </div>
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
              <ul className="divide-y rounded-md border">
                {tree.map(({ item: group, depth }) => (
                  <PageGroupRow
                    key={group.id}
                    group={group}
                    depth={depth}
                    isSelected={group.id === selectedGroupId}
                    defaultLocale={defaultLocale}
                    enabledLocales={enabledLocales}
                    draggable={canReorder}
                    onToggleSelected={() => toggleSelected(group.id)}
                  />
                ))}
              </ul>
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
