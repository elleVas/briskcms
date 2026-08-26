import { and, eq } from 'drizzle-orm';
import { Media, type MediaProps } from '@brisk/domain-core';
import type {
  MediaRepositoryPort,
  PaginatedResult,
  Pagination,
} from '@brisk/ports';
import {
  DrizzlePaginatedRepository,
  type BriskDb,
  media,
} from '@brisk/postgres-db';

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
export class DrizzleMediaRepository
  extends DrizzlePaginatedRepository<typeof media.$inferSelect, Media>
  implements MediaRepositoryPort
{
  protected readonly table = media;
  protected readonly idColumn = media.id;
  protected readonly tenantIdColumn = media.tenantId;

  constructor(db: BriskDb) {
    super(db);
  }

  protected toRow(mediaItem: Media) {
    return toRow(mediaItem.toProps());
  }

  protected fromRow(row: typeof media.$inferSelect): Media {
    return fromRow(row);
  }

  /** Most recently uploaded first — matches the pages list's ordering convention. */
  async listBySite(
    tenantId: string,
    siteId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<Media>> {
    return this.listPaginatedTx(
      tenantId,
      and(eq(media.tenantId, tenantId), eq(media.siteId, siteId)),
      media.createdAt,
      pagination,
    );
  }
}
