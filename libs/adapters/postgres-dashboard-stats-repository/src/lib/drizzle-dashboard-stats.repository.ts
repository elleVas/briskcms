import { and, count, desc, eq, sql } from 'drizzle-orm';
import type { DashboardStats, DashboardStatsPort } from '@brisk/ports';
import {
  type BriskDb,
  media,
  pageGroups,
  pageTranslations,
  withTenant,
} from '@brisk/postgres-db';

export class DrizzleDashboardStatsRepository implements DashboardStatsPort {
  constructor(private readonly db: BriskDb) {}

  async getStats(
    tenantId: string,
    siteId: string,
    recentActivityLimit: number,
  ): Promise<DashboardStats> {
    const [statusCounts, mediaTotals, recentRows] = await withTenant(
      this.db,
      tenantId,
      (tx) =>
        Promise.all([
          tx
            .select({ status: pageTranslations.status, total: count() })
            .from(pageTranslations)
            .where(
              and(
                eq(pageTranslations.tenantId, tenantId),
                eq(pageTranslations.siteId, siteId),
              ),
            )
            .groupBy(pageTranslations.status),
          tx
            .select({
              count: count(),
              // count()/sum() come back as bigint-safe strings from the
              // driver — coalesce to '0' so an empty site sums to 0, not
              // null, then Number() below (safe: total upload size for a
              // single self-hosted site is nowhere near
              // Number.MAX_SAFE_INTEGER bytes).
              totalSizeBytes: sql<string>`coalesce(sum(${media.size}), 0)`,
            })
            .from(media)
            .where(and(eq(media.tenantId, tenantId), eq(media.siteId, siteId))),
          tx
            .select({
              pageGroupId: pageTranslations.pageGroupId,
              pageTranslationId: pageTranslations.id,
              locale: pageTranslations.locale,
              title: sql<string>`${pageTranslations.seoMeta}->>'title'`,
              slug: pageTranslations.slug,
              status: pageTranslations.status,
              updatedAt: pageTranslations.updatedAt,
            })
            .from(pageTranslations)
            .innerJoin(
              pageGroups,
              eq(pageTranslations.pageGroupId, pageGroups.id),
            )
            .where(
              and(
                eq(pageTranslations.tenantId, tenantId),
                eq(pageTranslations.siteId, siteId),
              ),
            )
            .orderBy(desc(pageTranslations.updatedAt))
            .limit(recentActivityLimit),
        ]),
    );

    const publishedCount =
      statusCounts.find((row) => row.status === 'published')?.total ?? 0;
    const draftCount =
      statusCounts.find((row) => row.status === 'draft')?.total ?? 0;

    return {
      pages: { publishedCount, draftCount },
      media: {
        count: mediaTotals[0]?.count ?? 0,
        totalSizeBytes: Number(mediaTotals[0]?.totalSizeBytes ?? '0'),
      },
      recentActivity: recentRows.map((row) => ({
        ...row,
        title: row.title ?? '',
      })),
    };
  }
}
