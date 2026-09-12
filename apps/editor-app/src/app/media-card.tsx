import { useTranslation } from 'react-i18next';
import { FileAudio, FileVideo } from 'lucide-react';
import type { MediaDto } from '../lib/media-api-client';

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'] as const;

/** Same rounding as the dashboard's storage figure, so one file and the total agree. */
export function formatFileSize(bytes: number): string {
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${unitIndex === 0 ? value : value.toFixed(1)} ${BYTE_UNITS[unitIndex]}`;
}

/** What the file really is, from the MIME type the sniffer decided at upload (ADR-0054). */
export function mediaKindOf(mimeType: string): 'image' | 'video' | 'audio' {
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'image';
}

/** "webp", "mp4" — the half of the MIME type a person recognises. */
export function mediaFormatOf(mimeType: string): string {
  return (mimeType.split('/')[1] ?? mimeType).toUpperCase();
}

export interface MediaThumbnailProps {
  item: MediaDto;
}

/**
 * The picture, or a glyph for the two kinds that have none.
 *
 * Video and audio were being rendered through `<img src>` like everything
 * else, which draws a broken image: the grid showed nineteen files and
 * several of them were empty boxes.
 */
export function MediaThumbnail({ item }: MediaThumbnailProps) {
  const kind = mediaKindOf(item.mimeType);
  if (kind === 'image') {
    return (
      <img
        src={item.url}
        alt={item.filename}
        className="size-full object-cover"
      />
    );
  }
  return (
    <span className="flex size-full items-center justify-center bg-muted text-muted-foreground">
      {kind === 'video' ? (
        <FileVideo className="size-6" />
      ) : (
        <FileAudio className="size-6" />
      )}
    </span>
  );
}

export interface MediaMetaProps {
  item: MediaDto;
}

/**
 * Name, format, size and date, under the thumbnail.
 *
 * None of it was shown anywhere. With nineteen files the library was a grid
 * of dark rectangles — the docs screenshots are all black images, so they
 * were indistinguishable — and picking the right one meant opening each in
 * turn.
 */
export function MediaMeta({ item }: MediaMetaProps) {
  const { i18n } = useTranslation();
  const uploaded = new Date(item.createdAt);

  return (
    <div className="flex min-w-0 flex-col gap-0.5 px-1 pb-1 pt-1.5 text-left">
      <span className="truncate text-xs font-medium" title={item.filename}>
        {item.filename}
      </span>
      <span className="truncate text-[0.6875rem] text-muted-foreground tabular-nums">
        {mediaFormatOf(item.mimeType)} · {formatFileSize(item.size)}
        {Number.isNaN(uploaded.getTime())
          ? ''
          : ` · ${uploaded.toLocaleDateString(i18n.language)}`}
      </span>
    </div>
  );
}
