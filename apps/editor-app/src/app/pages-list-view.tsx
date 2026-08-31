import { useReducer } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
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
  Search,
  Send,
  Trash2,
} from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import type { PageListItem } from '../lib/pages-api-client';
import { ConfirmDeleteDialog } from './confirm-delete-dialog';
import { computeSiblingReorder } from './compute-sibling-reorder';
import { DuplicatePageDialog } from './duplicate-page-dialog';
import { IconButton } from './icon-button';
import { MediaPickerProvider } from './media-picker-provider';
import { NewPageDialog } from './new-page-dialog';
import { ParentPageSelect } from './parent-page-select';
import { buildPageTree } from './page-hierarchy';
import { PAGES_PAGE_SIZE, pageTranslationsQueryOptions } from './pages-queries';
import { SeoPanelDialog } from './seo-panel-dialog';
import { usePagesList } from './use-pages-list';

export interface PagesListViewProps {
  siteId: string;
  defaultLocale: string;
  pages: PageListItem[];
  page: number;
  total: number;
}

type DialogKind = 'new' | 'delete' | 'seo' | 'duplicate';

interface PagesListState {
  selectedPageId: string | null;
  openDialog: DialogKind | 'none';
  actionError: string;
}

const initialPagesListState: PagesListState = {
  selectedPageId: null,
  openDialog: 'none',
  actionError: '',
};

type PagesListAction =
  | { type: 'TOGGLE_SELECTED'; pageId: string }
  | { type: 'OPEN_DIALOG'; dialog: DialogKind }
  | { type: 'CLOSE_DIALOG' }
  | { type: 'SET_ERROR'; error: string };

/**
 * Prima erano 4 `useState` booleani indipendenti per i dialog + uno per la
 * selezione — nulla impediva che restassero "vero" insieme (es. sintomo
 * reale trovato rifattorizzando: dopo un'eliminazione riuscita
 * `isDeleteDialogOpen` non veniva mai resettato a `false`, quindi
 * selezionare una pagina diversa subito dopo faceva riapparire il dialog
 * di conferma eliminazione per la NUOVA pagina, mai richiesto). Un solo
 * `openDialog` esclusivo lo rende strutturalmente impossibile — cambiare
 * selezione chiude sempre qualunque dialog aperto.
 */
export function pagesListReducer(
  state: PagesListState,
  action: PagesListAction,
): PagesListState {
  switch (action.type) {
    case 'TOGGLE_SELECTED':
      return {
        selectedPageId:
          state.selectedPageId === action.pageId ? null : action.pageId,
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

interface SortablePageRowProps {
  page: PageListItem;
  depth: number;
  isSelected: boolean;
  siteId: string;
  onToggleSelected: () => void;
  onSetParent: (parentId: string | null) => void;
}

/**
 * A drag handle (not the whole row) drives dnd-kit here — the row already
 * has a select button AND a ParentPageSelect dropdown, both of which need
 * their own click handling untouched. See compute-sibling-reorder.ts for
 * why a drop is only meaningful within the same (locale, parentId) group.
 */
function SortablePageRow({
  page: p,
  depth,
  isSelected,
  siteId,
  onToggleSelected,
  onSetParent,
}: SortablePageRowProps) {
  const { t, i18n } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: p.id });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
      }}
      className="flex items-center gap-2 px-3"
    >
      <button
        type="button"
        aria-label={t('pages.list.dragHandle')}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>
      <button
        type="button"
        onClick={onToggleSelected}
        aria-pressed={isSelected}
        style={{ paddingLeft: depth * 20 }}
        className={cn(
          'flex flex-1 items-center justify-between py-2 text-left text-sm hover:bg-muted',
          isSelected && 'bg-muted',
        )}
      >
        <span className="flex items-center gap-3">
          <span
            aria-hidden
            className={cn(
              'size-3 shrink-0 rounded-full border',
              isSelected
                ? 'border-primary bg-primary'
                : 'border-muted-foreground',
            )}
          />
          <span className="flex flex-col">
            <span className="font-medium">{p.seoMeta.title || p.slug}</span>
            <span className="text-xs text-muted-foreground">{p.slug}</span>
          </span>
        </span>
        <span className="flex items-center gap-3">
          <Badge variant="outline" className="uppercase">
            {p.locale}
          </Badge>
          {p.hasUnpublishedChanges && (
            <Badge
              variant="outline"
              className="border-amber-600/30 text-amber-600 dark:border-amber-400/30 dark:text-amber-400"
            >
              {t('pages.list.pendingChanges')}
            </Badge>
          )}
          <Badge variant={p.status === 'published' ? 'default' : 'outline'}>
            {p.status === 'published'
              ? t('pages.list.statusPublished')
              : t('pages.list.statusDraft')}
          </Badge>
          {p.createdByName && (
            <span className="text-muted-foreground">
              {t('pages.list.createdBy', { name: p.createdByName })}
            </span>
          )}
          <span className="text-muted-foreground">
            {new Date(p.updatedAt).toLocaleDateString(i18n.language)}
          </span>
        </span>
      </button>
      <div className="w-40 shrink-0">
        <ParentPageSelect
          siteId={siteId}
          locale={p.locale}
          currentPageId={p.id}
          value={p.parentId}
          onChange={onSetParent}
        />
      </div>
    </li>
  );
}

export function PagesListView({
  siteId,
  defaultLocale,
  pages,
  page,
  total,
}: PagesListViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    createPage,
    deletePage,
    duplicatePage,
    publishPage,
    setPageParent,
    reorderPages,
  } = usePagesList(siteId, defaultLocale);
  const tree = buildPageTree(pages);

  // Same click-vs-drag distinction as canvas/layers-panel.tsx: without an
  // activation distance, dnd-kit would capture the pointer on a plain
  // click too, breaking the row's own select button.
  const dragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const [state, dispatch] = useReducer(pagesListReducer, initialPagesListState);
  const { selectedPageId, openDialog, actionError } = state;

  const selectedPage = pages.find((p) => p.id === selectedPageId) ?? null;
  const totalPages = Math.max(1, Math.ceil(total / PAGES_PAGE_SIZE));

  // Only matters, and is only fetched, when deleting a page that IS the
  // site's default locale: that's the one case where losing it also
  // breaks the untranslated-page-fallback redirect (and the x-default
  // hreflang) for every other locale in the same translation group, not
  // just this one page's own content.
  const isDeletingDefaultLocalePage =
    openDialog === 'delete' && selectedPage?.locale === defaultLocale;
  const translationsQuery = useQuery({
    ...pageTranslationsQueryOptions(selectedPage?.id ?? ''),
    enabled: isDeletingDefaultLocalePage,
  });
  const otherLocalesInGroup = isDeletingDefaultLocalePage
    ? (translationsQuery.data ?? [])
        .filter((p) => p.id !== selectedPage?.id)
        .map((p) => p.locale)
    : [];

  function toggleSelected(pageId: string) {
    dispatch({ type: 'TOGGLE_SELECTED', pageId });
  }

  function closeDialog() {
    dispatch({ type: 'CLOSE_DIALOG' });
  }

  function handleDragEnd(event: DragEndEvent) {
    const result = computeSiblingReorder(
      pages,
      String(event.active.id),
      event.over ? String(event.over.id) : null,
    );
    if (result) {
      void reorderPages(
        result.locale,
        result.parentId,
        result.orderedPageIds,
      ).catch((err) => dispatch({ type: 'SET_ERROR', error: String(err) }));
    }
  }

  async function goToPage(target: number) {
    await navigate({ to: '/pages', search: { page: target } });
  }

  async function handleOpenEditor() {
    if (!selectedPage) return;
    await navigate({
      to: '/pages/$pageId',
      params: { pageId: selectedPage.id },
    });
  }

  async function handlePublishSelected() {
    if (!selectedPage) return;
    dispatch({ type: 'SET_ERROR', error: '' });
    try {
      await publishPage(selectedPage.id);
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: String(err) });
    }
  }

  async function handleConfirmDelete() {
    if (!selectedPage) return;
    dispatch({ type: 'SET_ERROR', error: '' });
    try {
      await deletePage(selectedPage.id);
      // Deseleziona E chiude il dialog in un colpo solo (vedi il commento
      // sul reducer) — prima l'equivalente `setSelectedPageId(null)` non
      // chiudeva mai esplicitamente `isDeleteDialogOpen`.
      dispatch({ type: 'TOGGLE_SELECTED', pageId: selectedPage.id });
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
            {selectedPage && (
              <>
                <IconButton
                  label={t('pages.list.actions.edit')}
                  onClick={() => void handleOpenEditor()}
                >
                  <Pencil />
                </IconButton>
                <IconButton
                  label={t('pages.seo.open')}
                  onClick={() =>
                    dispatch({ type: 'OPEN_DIALOG', dialog: 'seo' })
                  }
                >
                  <Search />
                </IconButton>
                <IconButton
                  label={t('pages.list.actions.publish')}
                  onClick={() => void handlePublishSelected()}
                >
                  <Send />
                </IconButton>
                <IconButton
                  label={t('pages.list.actions.delete')}
                  onClick={() =>
                    dispatch({ type: 'OPEN_DIALOG', dialog: 'delete' })
                  }
                >
                  <Trash2 />
                </IconButton>
                <IconButton
                  label={t('pages.list.actions.duplicate')}
                  onClick={() =>
                    dispatch({ type: 'OPEN_DIALOG', dialog: 'duplicate' })
                  }
                >
                  <Copy />
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
        {actionError && (
          <p role="alert" className="text-sm text-destructive">
            {actionError}
          </p>
        )}
        {pages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('pages.list.empty')}
          </p>
        ) : (
          <DndContext
            sensors={dragSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={tree.map(({ page: p }) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="divide-y rounded-md border">
                {tree.map(({ page: p, depth }) => (
                  <SortablePageRow
                    key={p.id}
                    page={p}
                    depth={depth}
                    isSelected={p.id === selectedPageId}
                    siteId={siteId}
                    onToggleSelected={() => toggleSelected(p.id)}
                    onSetParent={(parentId) =>
                      void setPageParent(p.id, parentId).catch((err) =>
                        dispatch({ type: 'SET_ERROR', error: String(err) }),
                      )
                    }
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
        <NewPageDialog
          siteId={siteId}
          locale={defaultLocale}
          open={openDialog === 'new'}
          onOpenChange={(open) => !open && closeDialog()}
          onCreate={createPage}
        />
        {selectedPage && (
          <ConfirmDeleteDialog
            open={openDialog === 'delete'}
            onOpenChange={(open) => !open && closeDialog()}
            title={t('pages.deleteDialog.title')}
            description={
              otherLocalesInGroup.length > 0
                ? t('pages.deleteDialog.descriptionWithTranslations', {
                    name: selectedPage.seoMeta.title,
                    locales: otherLocalesInGroup.join(', '),
                  })
                : t('pages.deleteDialog.description', {
                    name: selectedPage.seoMeta.title,
                  })
            }
            onConfirm={() => void handleConfirmDelete()}
          />
        )}
        {selectedPage && (
          <SeoPanelDialog
            pageId={selectedPage.id}
            seoMeta={selectedPage.seoMeta}
            open={openDialog === 'seo'}
            onOpenChange={(open) => !open && closeDialog()}
          />
        )}
        {selectedPage && (
          <DuplicatePageDialog
            sourcePage={selectedPage}
            open={openDialog === 'duplicate'}
            onOpenChange={(open) => !open && closeDialog()}
            onDuplicate={(input) => duplicatePage(selectedPage.id, input)}
          />
        )}
      </div>
    </MediaPickerProvider>
  );
}
