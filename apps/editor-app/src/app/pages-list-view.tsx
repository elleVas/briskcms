import { useState, type ComponentProps, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { Pencil, Send, Trash2 } from 'lucide-react';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../components/ui/tooltip.js';
import { cn } from '../lib/utils.js';
import type { PageDto } from '../lib/pages-api-client.js';
import { DeletePageConfirmDialog } from './delete-page-confirm-dialog.js';
import { NewPageDialog } from './new-page-dialog.js';
import { usePagesList } from './use-pages-list.js';

export interface PagesListViewProps {
  siteId: string;
  pages: PageDto[];
}

export function PagesListView({ siteId, pages }: PagesListViewProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { createPage, deletePage, publishPage } = usePagesList(siteId);

  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [isNewPageDialogOpen, setIsNewPageDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [actionError, setActionError] = useState('');

  const selectedPage = pages.find((page) => page.id === selectedPageId) ?? null;

  function toggleSelected(pageId: string) {
    setSelectedPageId((current) => (current === pageId ? null : pageId));
    setActionError('');
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
        <p className="text-sm text-muted-foreground">{t('pages.list.empty')}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {pages.map((page) => {
            const isSelected = page.id === selectedPageId;
            return (
              <li key={page.id}>
                <button
                  type="button"
                  onClick={() => toggleSelected(page.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted',
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
                    {page.slug}
                  </span>
                  <span className="flex items-center gap-3">
                    <Badge
                      variant={
                        page.status === 'published' ? 'default' : 'outline'
                      }
                    >
                      {page.status === 'published'
                        ? t('pages.list.statusPublished')
                        : t('pages.list.statusDraft')}
                    </Badge>
                    <span className="text-muted-foreground">
                      {new Date(page.updatedAt).toLocaleDateString(
                        i18n.language,
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <NewPageDialog
        open={isNewPageDialogOpen}
        onOpenChange={setIsNewPageDialogOpen}
        onCreate={createPage}
      />
      {selectedPage && (
        <DeletePageConfirmDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          pageName={selectedPage.seoMeta.title}
          onConfirm={() => void handleConfirmDelete()}
        />
      )}
    </div>
  );
}

interface IconButtonProps extends ComponentProps<typeof Button> {
  label: string;
  children: ReactNode;
}

function IconButton({ label, children, ...props }: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
