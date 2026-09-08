import { and, asc, eq, inArray } from 'drizzle-orm';
import { ReusableSection, type ReusableSectionProps } from '@brisk/domain-core';
import type { ReusableSectionRepositoryPort } from '@brisk/ports';
import {
  DrizzlePaginatedRepository,
  type BriskDb,
  reusableSections,
  withTenant,
} from '@brisk/postgres-db';

function toRow(props: ReusableSectionProps) {
  return {
    id: props.id,
    tenantId: props.tenantId,
    siteId: props.siteId,
    name: props.name,
    kind: props.kind,
    status: props.status,
    content: props.content,
    publishedContent: props.publishedContent,
    exposedFields: props.exposedFields,
    createdBy: props.createdBy,
    createdAt: props.createdAt,
    updatedAt: props.updatedAt,
  };
}

function fromRow(row: typeof reusableSections.$inferSelect): ReusableSection {
  return ReusableSection.fromProps(row);
}

/** Connects as `brisk_app` — see docs/adr/0002-non-superuser-role-for-rls-enforcement.md. */
export class DrizzleReusableSectionRepository
  extends DrizzlePaginatedRepository<
    typeof reusableSections.$inferSelect,
    ReusableSection
  >
  implements ReusableSectionRepositoryPort
{
  protected readonly table = reusableSections;
  protected readonly idColumn = reusableSections.id;
  protected readonly tenantIdColumn = reusableSections.tenantId;

  constructor(db: BriskDb) {
    super(db);
  }

  protected toRow(section: ReusableSection) {
    return toRow(section.toProps());
  }

  protected fromRow(
    row: typeof reusableSections.$inferSelect,
  ): ReusableSection {
    return fromRow(row);
  }

  /**
   * One query for every section a page references, not one per reference:
   * a page can carry several instances and each render would otherwise
   * cost a round trip apiece — the same reason
   * `resolvePageContentReferences` memoises its own lookups.
   */
  async findByIds(tenantId: string, ids: string[]): Promise<ReusableSection[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(reusableSections)
        .where(
          and(
            eq(reusableSections.tenantId, tenantId),
            inArray(reusableSections.id, ids),
          ),
        ),
    );
    return rows.map(fromRow);
  }

  /** By name, because that is the order the insert menu shows them in. */
  async listBySite(
    tenantId: string,
    siteId: string,
  ): Promise<ReusableSection[]> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(reusableSections)
        .where(
          and(
            eq(reusableSections.tenantId, tenantId),
            eq(reusableSections.siteId, siteId),
          ),
        )
        .orderBy(asc(reusableSections.name)),
    );
    return rows.map(fromRow);
  }
}
