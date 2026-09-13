import { DOCUMENT_MIME_TYPES, type MediaKind } from '@brisk/shared-types';
import { and, eq, ilike, inArray, like, not, or, type SQL } from 'drizzle-orm';
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
    if (filter.kind) {
      conditions.push(kindCondition(filter.kind));
    }
    return this.listPaginatedTx(
      tenantId,
      and(...conditions),
      media.createdAt,
      pagination,
    );
  }
}

/**
 * The SQL spelling of `mediaKindOfMime` (@brisk/shared-types), which is
 * the definition — this has to agree with it, and the integration spec
 * checks that it does for every kind.
 *
 * Asked of the stored MIME type, which for an image, a video or an audio
 * file is what its bytes proved it was (ADR-0054), and for anything else
 * is what its name said (ADR-0070) — never what the uploader declared.
 */
function kindCondition(kind: MediaKind): SQL {
  const isDocument = defined(
    or(
      like(media.mimeType, 'text/%'),
      inArray(media.mimeType, [...DOCUMENT_MIME_TYPES]),
    ),
  );
  switch (kind) {
    case 'image':
    case 'video':
    case 'audio':
      return like(media.mimeType, `${kind}/%`);
    case 'document':
      return isDocument;
    case 'other':
      return defined(
        and(
          not(like(media.mimeType, 'image/%')),
          not(like(media.mimeType, 'video/%')),
          not(like(media.mimeType, 'audio/%')),
          not(isDocument),
        ),
      );
  }
}

/**
 * drizzle types `and()`/`or()` as possibly `undefined`, because every one
 * of their arguments may be. Here every argument is a real condition, so
 * the undefined branch cannot happen — checked rather than cast, so that
 * if it ever does it says so instead of silently matching every row.
 */
function defined(condition: SQL | undefined): SQL {
  if (!condition) {
    throw new Error('A media kind condition was built from no conditions');
  }
  return condition;
}
