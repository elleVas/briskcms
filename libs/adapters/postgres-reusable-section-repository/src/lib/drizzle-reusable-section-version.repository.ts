import { and, asc, eq } from 'drizzle-orm';
import type { ReusableSectionVersion } from '@brisk/domain-core';
import type { ReusableSectionVersionRepositoryPort } from '@brisk/ports';
import {
  type BriskDb,
  reusableSectionVersions,
  saveVersionTx,
  withTenant,
} from '@brisk/postgres-db';

/** Connects as `brisk_app` — see docs/adr/0002-non-superuser-role-for-rls-enforcement.md. */
export class DrizzleReusableSectionVersionRepository implements ReusableSectionVersionRepositoryPort {
  constructor(private readonly db: BriskDb) {}

  async save(version: ReusableSectionVersion): Promise<void> {
    await withTenant(this.db, version.tenantId, (tx) =>
      saveVersionTx(
        tx,
        reusableSectionVersions,
        {
          id: reusableSectionVersions.id,
          tenantId: reusableSectionVersions.tenantId,
          owner: reusableSectionVersions.reusableSectionId,
          createdAt: reusableSectionVersions.createdAt,
        },
        version,
        version.reusableSectionId,
      ),
    );
  }

  async findById(
    tenantId: string,
    versionId: string,
  ): Promise<ReusableSectionVersion | null> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(reusableSectionVersions)
        .where(
          and(
            eq(reusableSectionVersions.tenantId, tenantId),
            eq(reusableSectionVersions.id, versionId),
          ),
        )
        .limit(1),
    );
    return rows[0] ?? null;
  }

  /** Oldest first, matching every other version listing. */
  async listBySection(
    tenantId: string,
    reusableSectionId: string,
  ): Promise<ReusableSectionVersion[]> {
    return withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(reusableSectionVersions)
        .where(
          and(
            eq(reusableSectionVersions.tenantId, tenantId),
            eq(reusableSectionVersions.reusableSectionId, reusableSectionId),
          ),
        )
        .orderBy(asc(reusableSectionVersions.createdAt)),
    );
  }
}
