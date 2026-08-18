import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import type { MediaDto } from '../lib/media-api-client.js';
import { MediaGrid } from './media-grid.js';

export interface MediaLibraryViewProps {
  siteId: string;
  items: MediaDto[];
  page: number;
  total: number;
}

export function MediaLibraryView({
  siteId,
  items,
  page,
  total,
}: MediaLibraryViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  async function goToPage(target: number) {
    await navigate({ to: '/media', search: { page: target } });
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">{t('media.list.title')}</h1>
      <MediaGrid
        siteId={siteId}
        items={items}
        page={page}
        total={total}
        onPageChange={(target) => void goToPage(target)}
        showDelete
      />
    </div>
  );
}
