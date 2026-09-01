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
import {
  PAGE_GROUPS_PAGE_SIZE,
  pageGroupsQueryOptions,
} from './page-groups-queries';
import { IconButton } from './icon-button';

export interface PagePickerOption {
  pageGroupId: string;
  title: string;
  slug: string;
}

export interface PagePickerDialogProps {
  siteId: string;
  locale: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (page: PagePickerOption) => void;
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
  // just while visible. `locale` filters server-side (only groups that
  // actually have a translation in this locale come back), unlike the old
  // client-side filter this replaced — a NavLink only ever offers pages in
  // its own locale (docs/adr/0018).
  const { data } = useQuery({
    ...pageGroupsQueryOptions(siteId, page, { locale }),
    enabled: open,
  });
  const items: PagePickerOption[] = (data?.items ?? []).flatMap((group) => {
    const translation = group.translations.find((t) => t.locale === locale);
    return translation
      ? [
          {
            pageGroupId: group.id,
            title: translation.title || translation.slug,
            slug: translation.slug,
          },
        ]
      : [];
  });
  const totalPages = Math.max(
    1,
    Math.ceil((data?.total ?? 0) / PAGE_GROUPS_PAGE_SIZE),
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
              <li key={p.pageGroupId}>
                <button
                  type="button"
                  onClick={() => onSelect(p)}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted',
                  )}
                >
                  <span className="font-medium">{p.title}</span>
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
