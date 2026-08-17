import { and, eq } from 'drizzle-orm';
import { Page, type PageProps } from '@brisk/domain-core';
import type { PageRepositoryPort } from '@brisk/ports';
import { type BriskDb, pages, withTenant } from '@brisk/postgres-db';

function toRow(props: PageProps) {
  return {
    id: props.id,
    tenantId: props.tenantId,
    siteId: props.siteId,
    groupId: props.groupId,
    locale: props.locale,
    slug: props.slug,
    status: props.status,
    content: props.content,
    publishedContent: props.publishedContent,
    seoMeta: props.seoMeta,
    createdAt: props.createdAt,
    updatedAt: props.updatedAt,
  };
}

function fromRow(row: typeof pages.$inferSelect): Page {
  return Page.fromProps(row);
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

  async delete(tenantId: string, pageId: string): Promise<void> {
    await withTenant(this.db, tenantId, (tx) =>
      tx
        .delete(pages)
        .where(and(eq(pages.tenantId, tenantId), eq(pages.id, pageId))),
    );
  }
}
