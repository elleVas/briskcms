import {
  and,
  asc,
  count,
  eq,
  exists,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  sql,
} from 'drizzle-orm';
import {
  PageGroup,
  type PageGroupProps,
  type PageGroupVersion,
} from '@brisk/domain-core';
import type {
  PageGroupListFilters,
  PageGroupListItem,
  PageGroupRepositoryPort,
  PageGroupSummary,
  PaginatedResult,
  Pagination,
} from '@brisk/ports';
import {
  DrizzlePaginatedRepository,
  type BriskDb,
  type BriskTx,
  pageGroups,
  pageTranslations,
  users,
  withTenant,
} from '@brisk/postgres-db';
import { savePageGroupVersionTx } from './save-page-group-version-tx';

function toRow(props: PageGroupProps) {
  return {
    id: props.id,
    tenantId: props.tenantId,
    siteId: props.siteId,
    parentId: props.parentId,
    content: props.content,
    order: props.order,
    createdBy: props.createdBy,
    createdAt: props.createdAt,
    updatedAt: props.updatedAt,
  };
}

function fromRow(row: typeof pageGroups.$inferSelect): PageGroup {
  return PageGroup.fromProps({
    id: row.id,
    tenantId: row.tenantId,
    siteId: row.siteId,
    parentId: row.parentId,
    content: row.content,
    order: row.order,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/**
 * Owns the SHARED structure — see PageGroupRepositoryPort's own doc
 * comment. No UNIQUE constraint beyond the PK on `page_groups` itself
 * (unlike `pages`/`page_translations`, which carry the slug): so there is
 * no unique-violation mapping to do here.
 */
export class DrizzlePageGroupRepository
  extends DrizzlePaginatedRepository<
    typeof pageGroups.$inferSelect,
    PageGroup,
    ReturnType<typeof toRow>
  >
  implements PageGroupRepositoryPort
{
  protected readonly table = pageGroups;
  protected readonly idColumn = pageGroups.id;
  protected readonly tenantIdColumn = pageGroups.tenantId;

  constructor(db: BriskDb) {
    super(db);
  }

  protected toRow(group: PageGroup) {
    return toRow(group.toProps());
  }

  protected fromRow(row: typeof pageGroups.$inferSelect): PageGroup {
    return fromRow(row);
  }

  /** Saves the group and its new structure version in the SAME transaction — the same reason as PageRepositoryPort.saveWithVersion. */
  async saveWithVersion(
    group: PageGroup,
    version: PageGroupVersion,
  ): Promise<void> {
    const row = this.toRow(group);
    await withTenant(this.db, row.tenantId, async (tx: BriskTx) => {
      await this.upsertTx(tx, row);
      await savePageGroupVersionTx(tx, version);
    });
  }

  async listBySite(
    tenantId: string,
    siteId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<PageGroupSummary>> {
    const scope = and(
      eq(pageGroups.tenantId, tenantId),
      eq(pageGroups.siteId, siteId),
    );
    const [rows, totalRows] = await withTenant(this.db, tenantId, (tx) =>
      Promise.all([
        tx
          .select({
            id: pageGroups.id,
            tenantId: pageGroups.tenantId,
            siteId: pageGroups.siteId,
            parentId: pageGroups.parentId,
            order: pageGroups.order,
            createdBy: pageGroups.createdBy,
            createdAt: pageGroups.createdAt,
            updatedAt: pageGroups.updatedAt,
          })
          .from(pageGroups)
          .where(scope)
          .orderBy(asc(pageGroups.order), asc(pageGroups.createdAt))
          .limit(pagination.pageSize)
          .offset((pagination.page - 1) * pagination.pageSize),
        tx.select({ total: count() }).from(pageGroups).where(scope),
      ]),
    );
    return { items: rows, total: totalRows[0].total };
  }

  /**
   * Fase 4's pages-list view. Two-step query, not a single join: `page_groups`
   * has a 1:N with `page_translations`, so joining first and paginating the
   * joined result would paginate at the TRANSLATION-row level (a group with
   * 3 locales would count as 3 rows against `pagination.pageSize`) — wrong.
   * Instead: (1) find the page of matching GROUP ids (filters expressed as
   * `exists()` subqueries against page_translations where they need to
   * reach into per-locale data, e.g. `search`/`locale`), (2) fetch every
   * translation for exactly those ids, unpaginated, and assemble them
   * client-side (well within the "5-15 pagine per sito" scale this product
   * already assumes throughout).
   */
  async listBySiteFiltered(
    tenantId: string,
    siteId: string,
    pagination: Pagination,
    filters: PageGroupListFilters,
  ): Promise<PaginatedResult<PageGroupListItem>> {
    const conditions = [
      eq(pageGroups.tenantId, tenantId),
      eq(pageGroups.siteId, siteId),
    ];
    if (filters.createdAfter) {
      conditions.push(gte(pageGroups.createdAt, filters.createdAfter));
    }
    if (filters.createdBefore) {
      conditions.push(lte(pageGroups.createdAt, filters.createdBefore));
    }
    if (filters.createdBy) {
      conditions.push(eq(pageGroups.createdBy, filters.createdBy));
    }
    if (filters.search) {
      conditions.push(
        exists(
          this.db
            .select({ one: sql`1` })
            .from(pageTranslations)
            .where(
              and(
                eq(pageTranslations.pageGroupId, pageGroups.id),
                ilike(
                  sql`${pageTranslations.seoMeta}->>'title'`,
                  `%${filters.search}%`,
                ),
              ),
            ),
        ),
      );
    }
    if (filters.locale) {
      conditions.push(
        exists(
          this.db
            .select({ one: sql`1` })
            .from(pageTranslations)
            .where(
              and(
                eq(pageTranslations.pageGroupId, pageGroups.id),
                eq(pageTranslations.locale, filters.locale),
              ),
            ),
        ),
      );
    }
    const scope = and(...conditions);

    const [groupRows, totalRows] = await withTenant(this.db, tenantId, (tx) =>
      Promise.all([
        tx
          .select({
            id: pageGroups.id,
            tenantId: pageGroups.tenantId,
            siteId: pageGroups.siteId,
            parentId: pageGroups.parentId,
            order: pageGroups.order,
            createdBy: pageGroups.createdBy,
            createdByName: sql<
              string | null
            >`coalesce(${users.displayName}, ${users.email})`,
            createdAt: pageGroups.createdAt,
            updatedAt: pageGroups.updatedAt,
          })
          .from(pageGroups)
          .leftJoin(users, eq(users.id, pageGroups.createdBy))
          .where(scope)
          .orderBy(asc(pageGroups.order), asc(pageGroups.createdAt))
          .limit(pagination.pageSize)
          .offset((pagination.page - 1) * pagination.pageSize),
        tx.select({ total: count() }).from(pageGroups).where(scope),
      ]),
    );

    const groupIds = groupRows.map((row) => row.id);
    const translationRows =
      groupIds.length === 0
        ? []
        : await withTenant(this.db, tenantId, (tx) =>
            tx
              .select({
                pageGroupId: pageTranslations.pageGroupId,
                locale: pageTranslations.locale,
                slug: pageTranslations.slug,
                title: sql<string>`${pageTranslations.seoMeta}->>'title'`,
                status: pageTranslations.status,
                isDiverged: pageTranslations.isDiverged,
              })
              .from(pageTranslations)
              .where(inArray(pageTranslations.pageGroupId, groupIds)),
          );

    const translationsByGroup = new Map<
      string,
      PageGroupListItem['translations']
    >();
    for (const row of translationRows) {
      const list = translationsByGroup.get(row.pageGroupId) ?? [];
      list.push({
        locale: row.locale,
        slug: row.slug,
        title: row.title,
        status: row.status,
        isDiverged: row.isDiverged,
      });
      translationsByGroup.set(row.pageGroupId, list);
    }

    return {
      items: groupRows.map((row) => ({
        ...row,
        translations: translationsByGroup.get(row.id) ?? [],
      })),
      total: totalRows[0].total,
    };
  }

  /** Siblings in the SHARED hierarchy — it replaces PageRepositoryPort.listSiblings, without `locale` (a position in the tree is no longer per-locale). */
  async listSiblings(
    tenantId: string,
    siteId: string,
    parentId: string | null,
  ): Promise<PageGroupSummary[]> {
    return withTenant(this.db, tenantId, (tx) =>
      tx
        .select({
          id: pageGroups.id,
          tenantId: pageGroups.tenantId,
          siteId: pageGroups.siteId,
          parentId: pageGroups.parentId,
          order: pageGroups.order,
          createdBy: pageGroups.createdBy,
          createdAt: pageGroups.createdAt,
          updatedAt: pageGroups.updatedAt,
        })
        .from(pageGroups)
        .where(
          and(
            eq(pageGroups.tenantId, tenantId),
            eq(pageGroups.siteId, siteId),
            parentId === null
              ? isNull(pageGroups.parentId)
              : eq(pageGroups.parentId, parentId),
          ),
        )
        .orderBy(asc(pageGroups.order), asc(pageGroups.createdAt)),
    );
  }
}
