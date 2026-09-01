import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { FileText, Image as ImageIcon } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import type { DashboardStatsDto } from '../lib/dashboard-api-client';

export interface DashboardViewProps {
  stats: DashboardStatsDto;
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'] as const;

function formatBytes(bytes: number): string {
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${unitIndex === 0 ? value : value.toFixed(1)} ${BYTE_UNITS[unitIndex]}`;
}

export function DashboardView({ stats }: DashboardViewProps) {
  const { t, i18n } = useTranslation();
  const totalPages = stats.pages.publishedCount + stats.pages.draftCount;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">{t('dashboard.title')}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.stats.pages.title')}</CardTitle>
            <CardDescription>
              {t('dashboard.stats.pages.description', { count: totalPages })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-semibold">{totalPages}</span>
              <span className="text-sm text-muted-foreground">
                {t('dashboard.stats.pages.breakdown', {
                  published: stats.pages.publishedCount,
                  draft: stats.pages.draftCount,
                })}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.stats.media.title')}</CardTitle>
            <CardDescription>
              {t('dashboard.stats.media.description', {
                count: stats.media.count,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-semibold">
                {stats.media.count}
              </span>
              <span className="text-sm text-muted-foreground">
                {formatBytes(stats.media.totalSizeBytes)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.stats.published.title')}</CardTitle>
            <CardDescription>
              {t('dashboard.stats.published.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">
              {stats.pages.publishedCount}
            </span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.recentActivity.title')}</CardTitle>
          <CardDescription>
            {t('dashboard.recentActivity.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('dashboard.recentActivity.empty')}
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {stats.recentActivity.map((item) => (
                <li
                  key={item.pageTranslationId}
                  className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                >
                  <Link
                    to="/pages"
                    className="flex min-w-0 items-center gap-2 hover:underline"
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">
                      {item.title || item.slug}
                    </span>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline">{item.locale}</Badge>
                    <Badge
                      variant={
                        item.status === 'published' ? 'default' : 'secondary'
                      }
                    >
                      {t(`dashboard.recentActivity.status.${item.status}`)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.updatedAt).toLocaleDateString(
                        i18n.language,
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {stats.media.count === 0 && totalPages === 0 && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ImageIcon className="size-4" />
          {t('dashboard.emptyState')}
        </p>
      )}
    </div>
  );
}
