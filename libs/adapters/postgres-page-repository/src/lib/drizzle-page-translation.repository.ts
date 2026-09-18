import { and, eq, isNull, sql } from 'drizzle-orm';
import {
  PageTranslation,
  type PageTranslationVersion,
} from '@brisk/domain-core';
import type { PageTranslationRepositoryPort } from '@brisk/ports';
import {
  type BriskDb,
  type BriskTx,
  pageTranslations,
  withTenant,
} from '@brisk/postgres-db';
import {
  pageTranslationRow,
  upsertPageTranslationTx,
  withPageTranslationUniqueViolations,
} from './page-translation-write-tx';
import { savePageTranslationVersionTx } from './save-page-translation-version-tx';

function fromRow(row: typeof pageTranslations.$inferSelect): PageTranslation {
  return PageTranslation.fromProps({
    id: row.id,
    tenantId: row.tenantId,
    siteId: row.siteId,
    pageGroupId: row.pageGroupId,
    locale: row.locale,
    slug: row.slug,
    formerSlugs: row.formerSlugs,
    formerParents: row.formerParents,
    seoMeta: row.seoMeta,
    fieldValues: row.fieldValues,
    status: row.status,
    publishedSnapshot: row.publishedSnapshot,
    isDiverged: row.isDiverged,
    divergedContent: row.divergedContent,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
    contentUpdatedAt: row.contentUpdatedAt,
    publishedAt: row.publishedAt,
  });
}

/**
 * Owns the per-locale text — see PageTranslationRepositoryPort's own doc
 * comment. It does NOT extend DrizzlePaginatedRepository the way
 * DrizzlePageGroupRepository does: the Port needs no paginated list (the
 * paginated page list lives on PageGroupRepositoryPort), so the basic CRUD
 * is written by hand here rather than inherited — the base class is meant
 * for "the same CRUD repeated identically", not for being extended for two
 * of its methods alone.
 */
export class DrizzlePageTranslationRepository implements PageTranslationRepositoryPort {
  constructor(private readonly db: BriskDb) {}

  async save(
    translation: PageTranslation,
    parentGroupId: string | null,
  ): Promise<void> {
    const row = pageTranslationRow(translation.toProps(), parentGroupId);
    await withPageTranslationUniqueViolations(row, () =>
      withTenant(this.db, row.tenantId, (tx) =>
        upsertPageTranslationTx(tx, row),
      ),
    );
  }

  /** Saves the translation and its new text version in the SAME transaction — the same reason as PageRepositoryPort.saveWithVersion. */
  async saveWithVersion(
    translation: PageTranslation,
    version: PageTranslationVersion,
    parentGroupId: string | null,
  ): Promise<void> {
    const row = pageTranslationRow(translation.toProps(), parentGroupId);
    await withPageTranslationUniqueViolations(row, () =>
      withTenant(this.db, row.tenantId, async (tx: BriskTx) => {
        await upsertPageTranslationTx(tx, row);
        await savePageTranslationVersionTx(tx, version);
      }),
    );
  }

  async findById(
    tenantId: string,
    pageTranslationId: string,
  ): Promise<PageTranslation | null> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(pageTranslations)
        .where(
          and(
            eq(pageTranslations.tenantId, tenantId),
            eq(pageTranslations.id, pageTranslationId),
          ),
        )
        .limit(1),
    );
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async findByGroupAndLocale(
    tenantId: string,
    pageGroupId: string,
    locale: string,
  ): Promise<PageTranslation | null> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(pageTranslations)
        .where(
          and(
            eq(pageTranslations.tenantId, tenantId),
            eq(pageTranslations.pageGroupId, pageGroupId),
            eq(pageTranslations.locale, locale),
          ),
        )
        .limit(1),
    );
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async listByGroup(
    tenantId: string,
    pageGroupId: string,
  ): Promise<PageTranslation[]> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(pageTranslations)
        .where(
          and(
            eq(pageTranslations.tenantId, tenantId),
            eq(pageTranslations.pageGroupId, pageGroupId),
          ),
        ),
    );
    return rows.map(fromRow);
  }

  /** See the port — used to find the pages a published section appears on. */
  async listPublishedBySite(
    tenantId: string,
    siteId: string,
  ): Promise<PageTranslation[]> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(pageTranslations)
        .where(
          and(
            eq(pageTranslations.tenantId, tenantId),
            eq(pageTranslations.siteId, siteId),
            eq(pageTranslations.status, 'published'),
          ),
        ),
    );
    return rows.map(fromRow);
  }

  /** Vedi PageTranslationRepositoryPort's own doc comment — cammina la gerarchia CONDIVISA un segmento alla volta, tramite `parentGroupId` (denormalizzato da PageGroup.parentId, vedi schema.ts). */
  async findByParentGroupAndLocaleSlug(
    tenantId: string,
    siteId: string,
    locale: string,
    parentGroupId: string | null,
    slug: string,
  ): Promise<PageTranslation | null> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(pageTranslations)
        .where(
          and(
            eq(pageTranslations.tenantId, tenantId),
            eq(pageTranslations.siteId, siteId),
            eq(pageTranslations.locale, locale),
            parentGroupId === null
              ? isNull(pageTranslations.parentGroupId)
              : eq(pageTranslations.parentGroupId, parentGroupId),
            eq(pageTranslations.slug, slug),
          ),
        )
        .limit(1),
    );
    return rows[0] ? fromRow(rows[0]) : null;
  }

  /**
   * The translation that USED to answer at this address, if one did.
   *
   * Asked only after `findByParentGroupAndLocaleSlug` came back empty, so
   * the cost lands on a request that was going to be a 404 either way —
   * and a crawler following a link somebody saved two years ago is
   * exactly the visitor this is for.
   *
   * Scoped by parent like the current-slug lookup: a page renamed from
   * `contatti` under one section must not answer for a `contatti` that
   * never existed under another.
   */
  async findByFormerSlug(
    tenantId: string,
    siteId: string,
    locale: string,
    parentGroupId: string | null,
    slug: string,
  ): Promise<PageTranslation | null> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(pageTranslations)
        .where(
          and(
            eq(pageTranslations.tenantId, tenantId),
            eq(pageTranslations.siteId, siteId),
            eq(pageTranslations.locale, locale),
            parentGroupId === null
              ? isNull(pageTranslations.parentGroupId)
              : eq(pageTranslations.parentGroupId, parentGroupId),
            sql`${pageTranslations.formerSlugs} @> ARRAY[${slug}]::text[]`,
          ),
        )
        .limit(1),
    );
    return rows[0] ? fromRow(rows[0]) : null;
  }

  /*
   * `@>` on jsonb, the same containment test `findByFormerSlug` does on a
   * text array: "is this pair among the places it used to live?". A move
   * away from the site root is stored as a JSON null, which is why the
   * pair is built here rather than interpolated as two comparisons.
   */
  async findByFormerParent(
    tenantId: string,
    siteId: string,
    locale: string,
    parentGroupId: string | null,
    slug: string,
  ): Promise<PageTranslation | null> {
    const pair = JSON.stringify([{ parentGroupId, slug }]);
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(pageTranslations)
        .where(
          and(
            eq(pageTranslations.tenantId, tenantId),
            eq(pageTranslations.siteId, siteId),
            eq(pageTranslations.locale, locale),
            sql`${pageTranslations.formerParents} @> ${pair}::jsonb`,
          ),
        )
        .limit(1),
    );
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async delete(tenantId: string, pageTranslationId: string): Promise<void> {
    await withTenant(this.db, tenantId, (tx) =>
      tx
        .delete(pageTranslations)
        .where(
          and(
            eq(pageTranslations.tenantId, tenantId),
            eq(pageTranslations.id, pageTranslationId),
          ),
        ),
    );
  }
}
