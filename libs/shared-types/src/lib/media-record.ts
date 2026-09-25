import { z } from 'zod';
import { MEDIA_KINDS } from './media-kind';

/** Where a file's bytes live — the one list the domain, the wire and the database's `storage_provider` enum all read. */
export const STORAGE_PROVIDERS = ['local', 's3'] as const;
export type StorageProvider = (typeof STORAGE_PROVIDERS)[number];

/** One file in the library, as every `/media` response carries it (docs/adr/0026). */
export const mediaRecordSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  siteId: z.string(),
  filename: z.string(),
  storageKey: z.string(),
  storageProvider: z.enum(STORAGE_PROVIDERS),
  mimeType: z.string(),
  size: z.number(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  createdAt: z.string(),
  /** Resolved by the storage adapter, so a file moved to S3 is not a different record. */
  url: z.string(),
});
export type MediaRecord = z.infer<typeof mediaRecordSchema>;

export const paginatedMediaSchema = z.object({
  items: z.array(mediaRecordSchema),
  total: z.number(),
});
export type PaginatedMedia = z.infer<typeof paginatedMediaSchema>;

/** `GET /media/kinds` — how many files each of the library's folders holds, one entry per kind even when it is zero. */
export const mediaKindCountsSchema = z.record(z.enum(MEDIA_KINDS), z.number());
export type MediaKindCounts = z.infer<typeof mediaKindCountsSchema>;
