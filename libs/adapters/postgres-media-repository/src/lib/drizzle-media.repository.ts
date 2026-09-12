import { and, eq, ilike, like, type SQL } from 'drizzle-orm';
import { Media, type MediaProps } from '@brisk/domain-core';
import type {
  MediaFilter,
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

/** Neutralises LIKE's own wildcards so a filename containing one is searched for literally. */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
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
    filter: MediaFilter = {},
  ): Promise<PaginatedResult<Media>> {
    const conditions: SQL[] = [
      eq(media.tenantId, tenantId),
      eq(media.siteId, siteId),
    ];
    // `%` and `_` in a filename would otherwise be wildcards: somebody
    // searching for "report_final" would match "reportXfinal" too.
    const search = filter.search?.trim();
    if (search) {
      conditions.push(ilike(media.filename, `%${escapeLikePattern(search)}%`));
    }
    // The MIME type's own prefix, which is what the sniffer decided the
    // file really was when it was stored (ADR-0054) — never the extension,
    // which a caller picks.
    if (filter.kind) {
      conditions.push(like(media.mimeType, `${filter.kind}/%`));
    }
    return this.listPaginatedTx(
      tenantId,
      and(...conditions),
      media.createdAt,
      pagination,
    );
  }
}
