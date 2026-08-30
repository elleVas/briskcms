import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import type { MediaDto } from '../lib/media-api-client';
import { MediaGrid } from './media-grid';
import { mediaQueryOptions } from './media-queries';

export interface MediaPickerDialogProps {
  siteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (media: MediaDto) => void;
}

export function MediaPickerDialog({
  siteId,
  open,
  onOpenChange,
  onSelect,
}: MediaPickerDialogProps) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  // Gated on `open`: this dialog is mounted for the lifetime of the page
  // editor (see MediaPickerProvider), not just while visible, so an
  // unconditional query would hit the media API on every editor load even
  // if the user never opens the picker.
  const { data } = useQuery({
    ...mediaQueryOptions(siteId, page),
    enabled: open,
  });

  function handleOpenChange(next: boolean) {
    // Always reopen on page 1, whatever page browsing left off on.
    if (!next) setPage(1);
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('media.picker.title')}</DialogTitle>
        </DialogHeader>
        {data && (
          <MediaGrid
            siteId={siteId}
            items={data.items}
            page={page}
            total={data.total}
            onPageChange={setPage}
            onSelect={onSelect}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
