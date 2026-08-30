import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { cn } from '../lib/utils';
import type { PageListItem } from '../lib/pages-api-client';
import { PAGES_PAGE_SIZE, pagesQueryOptions } from './pages-queries';
import { IconButton } from './icon-button';

export interface PagePickerDialogProps {
  siteId: string;
  locale: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (page: PageListItem) => void;
}

export function PagePickerDialog({
  siteId,
  locale,
  open,
  onOpenChange,
  onSelect,
}: PagePickerDialogProps) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  // Gated on `open`: same reasoning as FormPickerDialog/MediaPickerDialog —
  // this dialog is mounted for the lifetime of the section editor, not
  // just while visible.
  const { data } = useQuery({
    ...pagesQueryOptions(siteId, page),
    enabled: open,
  });
  // Client-side, not a new `locale` query param on GET /pages: at the
  // "5-15 pages per site" scale every page already fits on one server
  // page, so filtering here is enough and doesn't need a backend change
  // (docs/adr/0018) — a NavLink only ever offers pages in its own locale.
  const items = data?.items.filter((p) => p.locale === locale) ?? [];
  const totalPages = Math.max(
    1,
    Math.ceil((data?.total ?? 0) / PAGES_PAGE_SIZE),
  );

  function handleOpenChange(next: boolean) {
    if (!next) setPage(1);
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('pages.picker.title')}</DialogTitle>
        </DialogHeader>
        {data && items.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t('pages.picker.empty')}
          </p>
        )}
        {items.length > 0 && (
          <ul className="divide-y rounded-md border">
            {items.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelect(p)}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted',
                  )}
                >
                  <span className="font-medium">
                    {p.seoMeta.title || p.slug}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {p.slug}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <IconButton
              label={t('pages.list.previousPage')}
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft />
            </IconButton>
            <span className="text-sm text-muted-foreground">
              {t('pages.list.pageIndicator', { page, totalPages })}
            </span>
            <IconButton
              label={t('pages.list.nextPage')}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight />
            </IconButton>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
