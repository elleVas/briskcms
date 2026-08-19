import { and, eq } from 'drizzle-orm';
import {
  SiteLayoutSection,
  type SiteLayoutSectionKind,
  type SiteLayoutSectionProps,
} from '@brisk/domain-core';
import type { SiteLayoutSectionRepositoryPort } from '@brisk/ports';
import {
  type BriskDb,
  siteLayoutSections,
  withTenant,
} from '@brisk/postgres-db';

function toRow(props: SiteLayoutSectionProps) {
  return {
    id: props.id,
    tenantId: props.tenantId,
    siteId: props.siteId,
    locale: props.locale,
    kind: props.kind,
    status: props.status,
    content: props.content,
    publishedContent: props.publishedContent,
    sticky: props.sticky,
    createdAt: props.createdAt,
    updatedAt: props.updatedAt,
  };
}

function fromRow(
  row: typeof siteLayoutSections.$inferSelect,
): SiteLayoutSection {
  return SiteLayoutSection.fromProps(row);
}

/** Connects as `brisk_app` — see docs/adr/0002-non-superuser-role-for-rls-enforcement.md. */
export class DrizzleSiteLayoutSectionRepository implements SiteLayoutSectionRepositoryPort {
  constructor(private readonly db: BriskDb) {}

  async save(section: SiteLayoutSection): Promise<void> {
    const row = toRow(section.toProps());
    await withTenant(this.db, row.tenantId, (tx) =>
      tx
        .insert(siteLayoutSections)
        .values(row)
        .onConflictDoUpdate({ target: siteLayoutSections.id, set: row }),
    );
  }

  async findById(
    tenantId: string,
    id: string,
  ): Promise<SiteLayoutSection | null> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(siteLayoutSections)
        .where(
          and(
            eq(siteLayoutSections.tenantId, tenantId),
            eq(siteLayoutSections.id, id),
          ),
        )
        .limit(1),
    );
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async findBySiteLocaleKind(
    tenantId: string,
    siteId: string,
    locale: string,
    kind: SiteLayoutSectionKind,
  ): Promise<SiteLayoutSection | null> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(siteLayoutSections)
        .where(
          and(
            eq(siteLayoutSections.tenantId, tenantId),
            eq(siteLayoutSections.siteId, siteId),
            eq(siteLayoutSections.locale, locale),
            eq(siteLayoutSections.kind, kind),
          ),
        )
        .limit(1),
    );
    return rows[0] ? fromRow(rows[0]) : null;
  }
}
