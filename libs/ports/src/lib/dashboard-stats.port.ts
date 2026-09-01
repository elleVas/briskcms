export interface DashboardPageStats {
  publishedCount: number;
  draftCount: number;
}

export interface DashboardMediaStats {
  count: number;
  totalSizeBytes: number;
}

export interface DashboardRecentActivityItem {
  pageGroupId: string;
  pageTranslationId: string;
  locale: string;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  updatedAt: Date;
}

export interface DashboardStats {
  pages: DashboardPageStats;
  media: DashboardMediaStats;
  recentActivity: DashboardRecentActivityItem[];
}

/**
 * Its own Port, not extra methods bolted onto PageGroupRepositoryPort /
 * PageTranslationRepositoryPort / MediaRepositoryPort — same reasoning as
 * SearchPort's own doc comment: this is a read-only aggregation across
 * three tables (page_groups, page_translations, media) with no natural
 * home on any single entity's CRUD-oriented repository, and a future
 * non-Postgres deployment could swap this one adapter's aggregate queries
 * without touching any of those repositories' own contracts.
 */
export interface DashboardStatsPort {
  getStats(
    tenantId: string,
    siteId: string,
    recentActivityLimit: number,
  ): Promise<DashboardStats>;
}
