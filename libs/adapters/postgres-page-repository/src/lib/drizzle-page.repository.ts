import { and, eq } from 'drizzle-orm';
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
} from '@brisk/ports';
import {
  DrizzlePaginatedRepository,
  type BriskDb,
  type BriskTx,
  isUniqueViolation,
  pages,
  withTenant,
} from '@brisk/postgres-db';
import { savePageVersionTx } from './save-page-version-tx.js';

const SLUG_UNIQUE_CONSTRAINT = 'pages_tenant_id_site_id_locale_slug_unique';
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
      if (isUniqueViolation(error, SLUG_UNIQUE_CONSTRAINT)) {
        throw new PageSlugAlreadyExistsError(row.slug);
      }
      if (isUniqueViolation(error, TRANSLATION_UNIQUE_CONSTRAINT)) {
        throw new PageTranslationAlreadyExistsError(row.locale);
      }
      throw error;
    }
  }

  async findBySlug(
    tenantId: string,
    siteId: string,
    locale: string,
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
            eq(pages.slug, slug),
          ),
        )
        .limit(1),
    );
    return rows[0] ? fromRow(rows[0]) : null;
  }

  /** Most recently updated first — matches "wp-admin style" page list usage. */
  async listBySite(
    tenantId: string,
    siteId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<Page>> {
    return this.listPaginatedTx(
      tenantId,
      and(eq(pages.tenantId, tenantId), eq(pages.siteId, siteId)),
      pages.updatedAt,
      pagination,
    );
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
