import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, ShieldAlert, Trash2 } from 'lucide-react';
import type { MediaKind } from '@brisk/shared-types';
import { Button } from '../components/ui/button';
import type { MediaDto, MediaFilters } from '../lib/media-api-client';
import { ConfirmActionDialog } from './confirm-action-dialog';
import { IconButton } from './icon-button';
import { MediaFilterBar } from './media-filter-bar';
import { MediaMeta, MediaThumbnail } from './media-card';
import { MEDIA_PAGE_SIZE } from './media-queries';
import { useMediaLibrary } from './use-media-library';

export interface MediaGridProps {
  siteId: string;
  items: MediaDto[];
  page: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Search and kind, owned by the caller — the library page keeps them in the URL, the picker dialog in its own state. */
  filters: MediaFilters;
  onFiltersChange: (next: MediaFilters) => void;
  // Present only in the in-editor picker dialog — the library page (no
  // onSelect) shows files purely for browsing/deleting, not picking.
  onSelect?: (media: MediaDto) => void;
  // Present only on the library page — the picker dialog doesn't offer
  // deletion, to keep "pick an image for this block" and "manage the
  // library" as separate actions instead of tangling one dialog's state
  // with the other's.
  showDelete?: boolean;
  /** The one kind a picker is choosing — see MediaFilterBar. */
  lockedKind?: MediaKind;
}

/**
 * What the file chooser suggests, and only when a field has already said
 * what it takes.
 *
 * It used to be the server's exact allow-list, always. The library now
 * takes any file (ADR-0070), so on the library page there is nothing to
 * suggest — and inside a picker for a video field, `video/*` spares
 * somebody choosing a PDF that would then not appear in the list they
 * are looking at.
 */
const ACCEPT_BY_KIND: Partial<Record<MediaKind, string>> = {
  image: 'image/*',
  video: 'video/*',
  audio: 'audio/*',
};

export function MediaGrid({
  siteId,
  items,
  page,
  total,
  onPageChange,
  filters,
  onFiltersChange,
  onSelect,
  showDelete = false,
  lockedKind,
}: MediaGridProps) {
  const { t } = useTranslation();
  const { uploadMedia, isUploading, deleteMedia } = useMediaLibrary(siteId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [actionError, setActionError] = useState('');
  const [mediaToDelete, setMediaToDelete] = useState<MediaDto | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / MEDIA_PAGE_SIZE));
  const hasFilters = Boolean(filters.search?.trim() || filters.kind);

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MediaFilterBar
          value={filters}
          onChange={onFiltersChange}
          lockedKind={lockedKind}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept={lockedKind ? ACCEPT_BY_KIND[lockedKind] : undefined}
          className="hidden"
          onChange={(event) => void handleFileChange(event)}
        />
        {/* "Upload image" until now, and it has taken video and audio
            since PR #158 — the button was describing a restriction that no
            longer existed. */}
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? t('media.grid.uploading') : t('media.grid.upload')}
        </Button>
      </div>
      {/* The warning the owner asked for, in place of a check we do not
          make (ADR-0070): any file is taken, nothing is scanned, and the
          one protection there is — whatever is not an image, a video or
          an audio file downloads instead of opening — is not a reason to
          upload something you do not trust. */}
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <ShieldAlert className="mt-px size-3.5 shrink-0" aria-hidden />
        {t('media.grid.uploadWarning')}
      </p>
      {actionError && (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      )}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {/* "No files yet" is a lie when there are files and none of them
              match — it sends somebody to upload what they already have. */}
          {hasFilters ? t('media.grid.noMatches') : t('media.grid.empty')}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {items.map((item) => (
            <li
              key={item.id}
              className="group relative flex flex-col overflow-hidden rounded-lg border"
            >
              {onSelect ? (
                <button
                  type="button"
                  // Named by the file, explicitly: the button now holds the
                  // thumbnail AND the name, format, size and date, so its
                  // accessible name would otherwise be all of that read out
                  // twice over.
                  aria-label={item.filename}
                  onClick={() => onSelect(item)}
                  className="flex flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="aspect-square w-full overflow-hidden">
                    <MediaThumbnail item={item} />
                  </span>
                  <MediaMeta item={item} />
                </button>
              ) : (
                <>
                  <span className="aspect-square w-full overflow-hidden">
                    <MediaThumbnail item={item} />
                  </span>
                  <MediaMeta item={item} />
                </>
              )}
              {showDelete && (
                <IconButton
                  label={t('media.grid.delete')}
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => setMediaToDelete(item)}
                >
                  <Trash2 />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
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
