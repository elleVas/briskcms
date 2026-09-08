import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import type { MediaDto } from '../lib/media-api-client';
import { ConfirmActionDialog } from './confirm-action-dialog';
import { IconButton } from './icon-button';
import { MEDIA_PAGE_SIZE } from './media-queries';
import { useMediaLibrary } from './use-media-library';

export interface MediaGridProps {
  siteId: string;
  items: MediaDto[];
  page: number;
  total: number;
  onPageChange: (page: number) => void;
  // Present only in the in-editor picker dialog — the library page (no
  // onSelect) shows thumbnails purely for browsing/deleting, not picking.
  onSelect?: (media: MediaDto) => void;
  // Present only on the library page — the picker dialog doesn't offer
  // deletion, to keep "pick an image for this block" and "manage the
  // library" as separate actions instead of tangling one dialog's state
  // with the other's.
  showDelete?: boolean;
}

/**
 * The exact formats the server accepts (ADR-0054), rather than
 * `image/*`: a hint that matches the allow-list spares people picking a
 * file only to have it refused. Extensions AND MIME types, because
 * browsers differ on which they match. It is a hint and nothing more —
 * an upload's own bytes are what actually decides, server-side.
 */
const UPLOAD_ACCEPT = [
  '.png,.jpg,.jpeg,.gif,.webp,.avif',
  '.mp4,.webm,.mp3,.ogg,.wav',
  'image/png,image/jpeg,image/gif,image/webp,image/avif',
  'video/mp4,video/webm',
  'audio/mpeg,audio/ogg,audio/wav',
].join(',');

export function MediaGrid({
  siteId,
  items,
  page,
  total,
  onPageChange,
  onSelect,
  showDelete = false,
}: MediaGridProps) {
  const { t } = useTranslation();
  const { uploadMedia, isUploading, deleteMedia } = useMediaLibrary(siteId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [actionError, setActionError] = useState('');
  const [mediaToDelete, setMediaToDelete] = useState<MediaDto | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / MEDIA_PAGE_SIZE));

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset so picking the same file again later still fires onChange.
    event.target.value = '';
    if (!file) return;
    setActionError('');
    try {
      await uploadMedia(file);
    } catch (err) {
      setActionError(String(err));
    }
  }

  async function handleConfirmDelete() {
    if (!mediaToDelete) return;
    setActionError('');
    try {
      await deleteMedia(mediaToDelete.id);
      setMediaToDelete(null);
    } catch (err) {
      setActionError(String(err));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <input
          ref={fileInputRef}
          type="file"
          accept={UPLOAD_ACCEPT}
          className="hidden"
          onChange={(event) => void handleFileChange(event)}
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? t('media.grid.uploading') : t('media.grid.upload')}
        </Button>
      </div>
      {actionError && (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      )}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('media.grid.empty')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {items.map((item) => (
            <div
              key={item.id}
              className="group relative aspect-square overflow-hidden rounded-md border"
            >
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  className="size-full"
                >
                  <img
                    src={item.url}
                    alt={item.filename}
                    className="size-full object-cover"
                  />
                </button>
              ) : (
                <img
                  src={item.url}
                  alt={item.filename}
                  className="size-full object-cover"
                />
              )}
              {showDelete && (
                <IconButton
                  label={t('media.grid.delete')}
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100"
                  onClick={() => setMediaToDelete(item)}
                >
                  <Trash2 />
                </IconButton>
              )}
            </div>
          ))}
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <IconButton
            label={t('media.grid.previousPage')}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft />
          </IconButton>
          <span className="text-sm text-muted-foreground">
            {t('media.grid.pageIndicator', { page, totalPages })}
          </span>
          <IconButton
            label={t('media.grid.nextPage')}
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight />
          </IconButton>
        </div>
      )}
      {mediaToDelete && (
        <ConfirmActionDialog
          open={Boolean(mediaToDelete)}
          onOpenChange={(open) => !open && setMediaToDelete(null)}
          title={t('media.deleteDialog.title')}
          description={t('media.deleteDialog.description', {
            name: mediaToDelete.filename,
          })}
          onConfirm={() => void handleConfirmDelete()}
        />
      )}
    </div>
  );
}
