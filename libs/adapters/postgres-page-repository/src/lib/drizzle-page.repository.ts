import { and, count, desc, eq } from 'drizzle-orm';
import { Page, type PageProps } from '@brisk/domain-core';
import type {
  PaginatedResult,
  Pagination,
  PageRepositoryPort,
} from '@brisk/ports';
import { type BriskDb, pages, withTenant } from '@brisk/postgres-db';

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
export class DrizzlePageRepository implements PageRepositoryPort {
  constructor(private readonly db: BriskDb) {}

  async save(page: Page): Promise<void> {
    const row = toRow(page.toProps());
    await withTenant(this.db, row.tenantId, (tx) =>
      tx
        .insert(pages)
        .values(row)
        .onConflictDoUpdate({ target: pages.id, set: row }),
    );
  }

  async findById(tenantId: string, pageId: string): Promise<Page | null> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(pages)
        .where(and(eq(pages.tenantId, tenantId), eq(pages.id, pageId)))
        .limit(1),
    );
    return rows[0] ? fromRow(rows[0]) : null;
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
    const siteScope = and(
      eq(pages.tenantId, tenantId),
      eq(pages.siteId, siteId),
    );
    const [rows, [{ total }]] = await withTenant(this.db, tenantId, (tx) =>
      Promise.all([
        tx
          .select()
          .from(pages)
          .where(siteScope)
          .orderBy(desc(pages.updatedAt))
          .limit(pagination.pageSize)
          .offset((pagination.page - 1) * pagination.pageSize),
        tx.select({ total: count() }).from(pages).where(siteScope),
      ]),
    );
    return { items: rows.map(fromRow), total };
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

  async delete(tenantId: string, pageId: string): Promise<void> {
    await withTenant(this.db, tenantId, (tx) =>
      tx
        .delete(pages)
        .where(and(eq(pages.tenantId, tenantId), eq(pages.id, pageId))),
    );
  }
}
