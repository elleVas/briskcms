import { and, count, desc, eq } from 'drizzle-orm';
import { Media, type MediaProps } from '@brisk/domain-core';
import type {
  MediaRepositoryPort,
  PaginatedResult,
  Pagination,
} from '@brisk/ports';
import { type BriskDb, media, withTenant } from '@brisk/postgres-db';

function toRow(props: MediaProps) {
  return {
    id: props.id,
    tenantId: props.tenantId,
    siteId: props.siteId,
    filename: props.filename,
    storageKey: props.storageKey,
    storageProvider: props.storageProvider,
    mimeType: props.mimeType,
    size: props.size,
    width: props.width,
    height: props.height,
    createdAt: props.createdAt,
  };
}

function fromRow(row: typeof media.$inferSelect): Media {
  return Media.fromProps(row);
}

/** Connects as `brisk_app` — see docs/adr/0002-non-superuser-role-for-rls-enforcement.md. */
export class DrizzleMediaRepository implements MediaRepositoryPort {
  constructor(private readonly db: BriskDb) {}

  async save(mediaItem: Media): Promise<void> {
    const row = toRow(mediaItem.toProps());
    await withTenant(this.db, row.tenantId, (tx) =>
      tx
        .insert(media)
        .values(row)
        .onConflictDoUpdate({ target: media.id, set: row }),
    );
  }

  async findById(tenantId: string, mediaId: string): Promise<Media | null> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(media)
        .where(and(eq(media.tenantId, tenantId), eq(media.id, mediaId)))
        .limit(1),
    );
    return rows[0] ? fromRow(rows[0]) : null;
  }

  /** Most recently uploaded first — matches the pages list's ordering convention. */
  async listBySite(
    tenantId: string,
    siteId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<Media>> {
    const siteScope = and(
      eq(media.tenantId, tenantId),
      eq(media.siteId, siteId),
    );
    const [rows, [{ total }]] = await withTenant(this.db, tenantId, (tx) =>
      Promise.all([
        tx
          .select()
          .from(media)
          .where(siteScope)
          .orderBy(desc(media.createdAt))
          .limit(pagination.pageSize)
          .offset((pagination.page - 1) * pagination.pageSize),
        tx.select({ total: count() }).from(media).where(siteScope),
      ]),
    );
    return { items: rows.map(fromRow), total };
  }

  async delete(tenantId: string, mediaId: string): Promise<void> {
    await withTenant(this.db, tenantId, (tx) =>
      tx
        .delete(media)
        .where(and(eq(media.tenantId, tenantId), eq(media.id, mediaId))),
    );
  }
}
