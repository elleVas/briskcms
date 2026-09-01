import { request } from './http-client';

export interface DashboardStatsDto {
  pages: { publishedCount: number; draftCount: number };
  media: { count: number; totalSizeBytes: number };
  recentActivity: {
    pageGroupId: string;
    pageTranslationId: string;
    locale: string;
    title: string;
    slug: string;
    status: 'draft' | 'published';
    updatedAt: string;
  }[];
}

export function getDashboardStats(siteId: string): Promise<DashboardStatsDto> {
  const params = new URLSearchParams({ siteId });
  return request(`/dashboard/stats?${params.toString()}`);
}
