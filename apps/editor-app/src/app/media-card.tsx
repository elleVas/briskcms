import { useTranslation } from 'react-i18next';
import { File, FileAudio, FileText, FileVideo } from 'lucide-react';
import { mediaKindOfMime } from '@brisk/shared-types';
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

/**
 * "WEBP", "MP4", "PDF" — what a person recognises a file by.
 *
 * For an image, a video or an audio file, the format it is really STORED
 * in: a photo uploaded as `foto.png` was re-encoded to WebP (ADR-0013),
 * and calling it PNG would describe a file that no longer exists. For
 * everything else, the file's own extension: the MIME type of a Word file
 * is `application/vnd.openxmlformats-officedocument.wordprocessingml.document`,
 * and none of that is a format anybody has heard of.
 */
export function mediaFormatOf(
  item: Pick<MediaDto, 'filename' | 'mimeType'>,
): string {
  const subtype = (item.mimeType.split('/')[1] ?? item.mimeType).split('+')[0];
  const extension = /\.([a-z0-9]{1,10})$/i.exec(item.filename)?.[1];
  const isPlainMediaType =
    ['image', 'video', 'audio'].includes(mediaKindOfMime(item.mimeType)) &&
    !/^(vnd\.|x-)/i.test(subtype);
  return (isPlainMediaType ? subtype : (extension ?? subtype)).toUpperCase();
}

const KIND_GLYPH = {
  video: FileVideo,
  audio: FileAudio,
  document: FileText,
  other: File,
} as const;

export interface MediaThumbnailProps {
  item: MediaDto;
}

/**
 * The picture, or a glyph for every kind that has none.
 *
 * Video and audio were being rendered through `<img src>` like everything
 * else, which draws a broken image: the grid showed nineteen files and
 * several of them were empty boxes. The kind comes from the one shared
 * rule (`mediaKindOfMime`) — the local copy of it called anything that
 * was not video or audio an image, which is what a PDF would have become.
 */
export function MediaThumbnail({ item }: MediaThumbnailProps) {
  const kind = mediaKindOfMime(item.mimeType);
  if (kind === 'image') {
    return (
      <img
        src={item.url}
        alt={item.filename}
        className="size-full object-cover"
      />
    );
  }
  const Glyph = KIND_GLYPH[kind];
  return (
    <span className="flex size-full items-center justify-center bg-muted text-muted-foreground">
      <Glyph className="size-6" aria-hidden />
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
        {mediaFormatOf(item)} · {formatFileSize(item.size)}
        {Number.isNaN(uploaded.getTime())
          ? ''
          : ` · ${uploaded.toLocaleDateString(i18n.language)}`}
      </span>
    </div>
  );
}
