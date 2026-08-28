import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Pencil,
  Search,
  Send,
  Trash2,
} from 'lucide-react';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import { cn } from '../lib/utils.js';
import type { PageListItem } from '../lib/pages-api-client.js';
import { ConfirmDeleteDialog } from './confirm-delete-dialog.js';
import { DuplicatePageDialog } from './duplicate-page-dialog.js';
import { IconButton } from './icon-button.js';
import { MediaPickerProvider } from './media-picker-provider.js';
import { NewPageDialog } from './new-page-dialog.js';
import { ParentPageSelect } from './parent-page-select.js';
import { buildPageTree } from './page-hierarchy.js';
import {
  PAGES_PAGE_SIZE,
  pageTranslationsQueryOptions,
} from './pages-queries.js';
import { SeoPanelDialog } from './seo-panel-dialog.js';
import { usePagesList } from './use-pages-list.js';

export interface PagesListViewProps {
  siteId: string;
  defaultLocale: string;
  pages: PageListItem[];
  page: number;
  total: number;
}

export function PagesListView({
  siteId,
  defaultLocale,
  pages,
  page,
  total,
}: PagesListViewProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { createPage, deletePage, duplicatePage, publishPage, setPageParent } =
    usePagesList(siteId, defaultLocale);
  const tree = buildPageTree(pages);

  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [isNewPageDialogOpen, setIsNewPageDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSeoOpen, setIsSeoOpen] = useState(false);
  const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);
  const [actionError, setActionError] = useState('');

  const selectedPage = pages.find((p) => p.id === selectedPageId) ?? null;
  const totalPages = Math.max(1, Math.ceil(total / PAGES_PAGE_SIZE));

  // Only matters, and is only fetched, when deleting a page that IS the
  // site's default locale: that's the one case where losing it also
  // breaks the untranslated-page-fallback redirect (and the x-default
  // hreflang) for every other locale in the same translation group, not
  // just this one page's own content.
  const isDeletingDefaultLocalePage =
    isDeleteDialogOpen && selectedPage?.locale === defaultLocale;
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
    setSelectedPageId((current) => (current === pageId ? null : pageId));
    setActionError('');
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
    setActionError('');
    try {
      await publishPage(selectedPage.id);
    } catch (err) {
      setActionError(String(err));
    }
  }

  async function handleConfirmDelete() {
    if (!selectedPage) return;
    setActionError('');
    try {
      await deletePage(selectedPage.id);
      setSelectedPageId(null);
    } catch (err) {
      setActionError(String(err));
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
                  onClick={() => setIsSeoOpen(true)}
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
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  <Trash2 />
                </IconButton>
                <IconButton
                  label={t('pages.list.actions.duplicate')}
                  onClick={() => setIsDuplicateOpen(true)}
                >
                  <Copy />
                </IconButton>
              </>
            )}
            <Button onClick={() => setIsNewPageDialogOpen(true)}>
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
          <ul className="divide-y rounded-md border">
            {tree.map(({ page: p, depth }) => {
              const isSelected = p.id === selectedPageId;
              return (
                <li key={p.id} className="flex items-center gap-2 px-3">
                  <button
                    type="button"
                    onClick={() => toggleSelected(p.id)}
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
                        <span className="font-medium">
                          {p.seoMeta.title || p.slug}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {p.slug}
                        </span>
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
                      <Badge
                        variant={
                          p.status === 'published' ? 'default' : 'outline'
                        }
                      >
                        {p.status === 'published'
                          ? t('pages.list.statusPublished')
                          : t('pages.list.statusDraft')}
                      </Badge>
                      <span className="text-muted-foreground">
                        {new Date(p.updatedAt).toLocaleDateString(
                          i18n.language,
                        )}
                      </span>
                    </span>
                  </button>
                  <div className="w-40 shrink-0">
                    <ParentPageSelect
                      siteId={siteId}
                      locale={p.locale}
                      currentPageId={p.id}
                      value={p.parentId}
                      onChange={(parentId) =>
                        void setPageParent(p.id, parentId).catch((err) =>
                          setActionError(String(err)),
                        )
                      }
                    />
                  </div>
                </li>
              );
            })}
          </ul>
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
          open={isNewPageDialogOpen}
          onOpenChange={setIsNewPageDialogOpen}
          onCreate={createPage}
        />
        {selectedPage && (
          <ConfirmDeleteDialog
            open={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
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
            open={isSeoOpen}
            onOpenChange={setIsSeoOpen}
          />
        )}
        {selectedPage && (
          <DuplicatePageDialog
            sourcePage={selectedPage}
            open={isDuplicateOpen}
            onOpenChange={setIsDuplicateOpen}
            onDuplicate={(input) => duplicatePage(selectedPage.id, input)}
          />
        )}
      </div>
    </MediaPickerProvider>
  );
}
