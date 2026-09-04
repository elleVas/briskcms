import { and, eq, isNull } from 'drizzle-orm';
import {
  PageSlugAlreadyExistsError,
  PageTranslation,
  PageTranslationLocaleAlreadyExistsError,
  type PageTranslationProps,
  type PageTranslationVersion,
} from '@brisk/domain-core';
import type { PageTranslationRepositoryPort } from '@brisk/ports';
import {
  type BriskDb,
  type BriskTx,
  isUniqueViolation,
  pageTranslations,
  withTenant,
} from '@brisk/postgres-db';
import { savePageTranslationVersionTx } from './save-page-translation-version-tx';

// The second name is the one ACTUALLY applied in Postgres, not the one
// Drizzle generates before truncation: Postgres identifiers are capped at
// 63 bytes, and this auto-generated name exceeds them — verified live with
// `select conname from pg_constraint where conrelid =
// 'page_translations'::regclass`, not assumed by analogy with `pages`'
// shorter name. `isUniqueViolation` does an exact comparison, and a wrong
// name here would let a raw PostgresError surface instead of the domain
// error.
const SLUG_UNIQUE_CONSTRAINT =
  'page_translations_tenant_id_site_id_locale_parent_group_id_slug';
const ROOT_SLUG_UNIQUE_CONSTRAINT = 'page_translations_root_slug_unique';
const LOCALE_UNIQUE_CONSTRAINT =
  'page_translations_tenant_id_page_group_id_locale_unique';

function toRow(props: PageTranslationProps, parentGroupId: string | null) {
  return {
    id: props.id,
    tenantId: props.tenantId,
    siteId: props.siteId,
    pageGroupId: props.pageGroupId,
    parentGroupId,
    locale: props.locale,
    slug: props.slug,
    seoMeta: props.seoMeta,
    fieldValues: props.fieldValues,
    status: props.status,
    publishedSnapshot: props.publishedSnapshot,
    isDiverged: props.isDiverged,
    divergedContent: props.divergedContent,
    createdBy: props.createdBy,
    createdAt: props.createdAt,
    updatedAt: props.updatedAt,
  };
}

function fromRow(row: typeof pageTranslations.$inferSelect): PageTranslation {
  return PageTranslation.fromProps({
    id: row.id,
    tenantId: row.tenantId,
    siteId: row.siteId,
    pageGroupId: row.pageGroupId,
    locale: row.locale,
    slug: row.slug,
    seoMeta: row.seoMeta,
    fieldValues: row.fieldValues,
    status: row.status,
    publishedSnapshot: row.publishedSnapshot,
    isDiverged: row.isDiverged,
    divergedContent: row.divergedContent,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
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
    const row = toRow(translation.toProps(), parentGroupId);
    await this.withUniqueViolationMapping(row, () =>
      withTenant(this.db, row.tenantId, (tx) => this.upsertTx(tx, row)),
    );
  }

  /** Saves the translation and its new text version in the SAME transaction — the same reason as PageRepositoryPort.saveWithVersion. */
  async saveWithVersion(
    translation: PageTranslation,
    version: PageTranslationVersion,
    parentGroupId: string | null,
  ): Promise<void> {
    const row = toRow(translation.toProps(), parentGroupId);
    await this.withUniqueViolationMapping(row, () =>
      withTenant(this.db, row.tenantId, async (tx: BriskTx) => {
        await this.upsertTx(tx, row);
        await savePageTranslationVersionTx(tx, version);
      }),
    );
  }

  private upsertTx(tx: BriskTx, row: ReturnType<typeof toRow>) {
    return tx
      .insert(pageTranslations)
      .values(row)
      .onConflictDoUpdate({ target: pageTranslations.id, set: row });
  }

  /** The same reason as its namesake in DrizzlePageRepository: a conflict under real concurrency has to be translated into the same domain error the use case throws in the common case, not left to surface as a raw 500. */
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
      if (isUniqueViolation(error, LOCALE_UNIQUE_CONSTRAINT)) {
        throw new PageTranslationLocaleAlreadyExistsError(row.locale);
      }
      throw error;
    }
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
