import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import type { MediaDto, MediaFilters } from '../lib/media-api-client';
import { MediaGrid } from './media-grid';

export interface MediaLibraryViewProps {
  siteId: string;
  items: MediaDto[];
  page: number;
  total: number;
  /** In the URL, like the pages list's own: a search worth doing is a search worth reloading into and sending to somebody. */
  filters: MediaFilters;
}

export function MediaLibraryView({
  siteId,
  items,
  page,
  total,
  filters,
}: MediaLibraryViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  async function goToPage(target: number) {
    await navigate({ to: '/media', search: { ...filters, page: target } });
  }

  async function changeFilters(next: MediaFilters) {
    // Back to page one: the file being looked for is very unlikely to be on
    // page four of a list that has just changed shape.
    await navigate({
      to: '/media',
      search: { page: 1, search: next.search || undefined, kind: next.kind },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold tracking-tight">
        {t('media.list.title')}
      </h1>
      <MediaGrid
        siteId={siteId}
        items={items}
        page={page}
        total={total}
        filters={filters}
        onFiltersChange={(next) => void changeFilters(next)}
        onPageChange={(target) => void goToPage(target)}
        showDelete
      />
    </div>
  );
}
