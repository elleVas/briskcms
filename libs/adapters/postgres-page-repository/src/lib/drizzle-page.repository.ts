import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  Page,
  PageSlugAlreadyExistsError,
  PageTranslationAlreadyExistsError,
  type PageProps,
  type PageVersion,
} from '@brisk/domain-core';
import type {
  PaginatedResult,
  Pagination,
  PageRepositoryPort,
  PageSummary,
} from '@brisk/ports';
import {
  DrizzlePaginatedRepository,
  type BriskDb,
  type BriskTx,
  isUniqueViolation,
  pages,
  withTenant,
} from '@brisk/postgres-db';
import { savePageVersionTx } from './save-page-version-tx';

// Sibling-scoped slug uniqueness needs two DB constraints, not one (see
// schema.ts's own comment): the composite unique (tenant, site, locale,
// parent_id, slug) catches a collision under the same non-null parent, but
// Postgres treats NULL <> NULL, so it never fires between two ROOT-level
// pages sharing a slug — pages_root_slug_unique (a partial unique index,
// WHERE parent_id IS NULL) is what catches that case specifically. Both
// map to the same domain error; the caller doesn't need to know which one
// fired.
const SLUG_UNIQUE_CONSTRAINT =
  'pages_tenant_id_site_id_locale_parent_id_slug_unique';
const ROOT_SLUG_UNIQUE_CONSTRAINT = 'pages_root_slug_unique';
const TRANSLATION_UNIQUE_CONSTRAINT =
  'pages_tenant_id_site_id_group_id_locale_unique';

function toRow(props: PageProps) {
  return {
    id: props.id,
    tenantId: props.tenantId,
    siteId: props.siteId,
    groupId: props.groupId,
    locale: props.locale,
    slug: props.slug,
    parentId: props.parentId,
    status: props.status,
    content: props.content,
    publishedContent: props.publishedContent,
    seoMeta: props.seoMeta,
    syncedStructureSignature: props.syncedStructureSignature,
    createdAt: props.createdAt,
    updatedAt: props.updatedAt,
  };
}

// Explicit field list, not a spread of `row`: the `pages` table also
// carries `searchText` (SearchPort's own concern, see
// @brisk/postgres-search-repository) — a naive spread would leak it into
// the domain entity's props and, from there, into every endpoint that
// returns `page.toProps()`, none of which know or care that column exists.
function fromRow(row: typeof pages.$inferSelect): Page {
  return Page.fromProps({
    id: row.id,
    tenantId: row.tenantId,
    siteId: row.siteId,
    groupId: row.groupId,
    locale: row.locale,
    slug: row.slug,
    parentId: row.parentId,
    status: row.status,
    content: row.content,
    publishedContent: row.publishedContent,
    seoMeta: row.seoMeta,
    syncedStructureSignature: row.syncedStructureSignature,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/** Connects as `brisk_app` — see docs/adr/0002-non-superuser-role-for-rls-enforcement.md. */
export class DrizzlePageRepository
  extends DrizzlePaginatedRepository<
    typeof pages.$inferSelect,
    Page,
    ReturnType<typeof toRow>
  >
  implements PageRepositoryPort
{
  protected readonly table = pages;
  protected readonly idColumn = pages.id;
  protected readonly tenantIdColumn = pages.tenantId;

  constructor(db: BriskDb) {
    super(db);
  }

  protected toRow(page: Page) {
    return toRow(page.toProps());
  }

  protected fromRow(row: typeof pages.$inferSelect): Page {
    return fromRow(row);
  }

  override async save(page: Page): Promise<void> {
    const row = this.toRow(page);
    await this.withUniqueViolationMapping(row, () =>
      withTenant(this.db, row.tenantId, (tx) => this.upsertTx(tx, row)),
    );
  }

  /**
   * Salva la pagina e la sua nuova versione in un'UNICA transazione — vedi
   * il commento su questo metodo in `PageRepositoryPort`. `page` e
   * `version` sono sempre coerenti tra loro (i 5 use-case che chiamano
   * questo metodo costruiscono `version.content` da `page.content` appena
   * prima), quindi non serve validare la relazione qui.
   */
  async saveWithVersion(page: Page, version: PageVersion): Promise<void> {
    const row = this.toRow(page);
    await this.withUniqueViolationMapping(row, () =>
      withTenant(this.db, row.tenantId, async (tx: BriskTx) => {
        await this.upsertTx(tx, row);
        await savePageVersionTx(tx, version);
      }),
    );
  }

  /**
   * `onConflictDoUpdate` copre solo un conflitto sulla PK (`id`, un UUID
   * appena generato: mai in conflitto su un vero insert) — un conflitto
   * sugli altri due UNIQUE della tabella (slug, o locale-nel-gruppo) risale
   * comunque come `PostgresError` grezzo. Sotto concorrenza reale (due
   * richieste quasi simultanee superano entrambe il check-then-act
   * dell'use-case) è questo il primo punto che vede il conflitto — va
   * tradotto nello stesso errore di dominio che l'use-case già lancia nel
   * caso comune, non lasciato risalire come 500 grezzo.
   */
  private async withUniqueViolationMapping<T>(
    row: ReturnType<typeof toRow>,
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (
        isUniqueViolation(error, SLUG_UNIQUE_CONSTRAINT) ||
        isUniqueViolation(error, ROOT_SLUG_UNIQUE_CONSTRAINT)
      ) {
        throw new PageSlugAlreadyExistsError(row.slug);
      }
      if (isUniqueViolation(error, TRANSLATION_UNIQUE_CONSTRAINT)) {
        throw new PageTranslationAlreadyExistsError(row.locale);
      }
      throw error;
    }
  }

  async findByParentAndSlug(
    tenantId: string,
    siteId: string,
    locale: string,
    parentId: string | null,
    slug: string,
  ): Promise<Page | null> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(pages)
        .where(
          and(
            eq(pages.tenantId, tenantId),
            eq(pages.siteId, siteId),
            eq(pages.locale, locale),
            // Not `eq(pages.parentId, parentId)`: for a root-level lookup
            // (parentId === null), SQL's `parent_id = NULL` is always
            // unknown/false, never a match — `IS NULL` is required.
            parentId === null
              ? isNull(pages.parentId)
              : eq(pages.parentId, parentId),
            eq(pages.slug, slug),
          ),
        )
        .limit(1),
    );
    return rows[0] ? fromRow(rows[0]) : null;
  }

  /**
   * Most recently updated first — matches "wp-admin style" page list
   * usage. Bespoke query, not `listPaginatedTx`: the list needs a lean
   * projection (no `content`/`publishedContent`, see `PageSummary`'s own
   * doc comment) plus a computed `hasUnpublishedChanges`, neither of which
   * the shared base method's generic `select()` can express.
   */
  async listBySite(
    tenantId: string,
    siteId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<PageSummary>> {
    const scope = and(eq(pages.tenantId, tenantId), eq(pages.siteId, siteId));
    const [rows, totalRows] = await withTenant(this.db, tenantId, (tx) =>
      Promise.all([
        tx
          .select({
            id: pages.id,
            tenantId: pages.tenantId,
            siteId: pages.siteId,
            groupId: pages.groupId,
            locale: pages.locale,
            slug: pages.slug,
            parentId: pages.parentId,
            status: pages.status,
            seoMeta: pages.seoMeta,
            createdAt: pages.createdAt,
            updatedAt: pages.updatedAt,
            hasUnpublishedChanges: sql<boolean>`${pages.status} = 'published' and ${pages.publishedContent} is distinct from ${pages.content}`,
          })
          .from(pages)
          .where(scope)
          .orderBy(desc(pages.updatedAt))
          .limit(pagination.pageSize)
          .offset((pagination.page - 1) * pagination.pageSize),
        tx.select({ total: count() }).from(pages).where(scope),
      ]),
    );
    return { items: rows, total: totalRows[0].total };
  }

  async listByGroup(
    tenantId: string,
    siteId: string,
    groupId: string,
  ): Promise<Page[]> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(pages)
        .where(
          and(
            eq(pages.tenantId, tenantId),
            eq(pages.siteId, siteId),
            eq(pages.groupId, groupId),
          ),
        ),
    );
    return rows.map(fromRow);
  }
}
