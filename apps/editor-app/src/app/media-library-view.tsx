import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import type { MediaDto, MediaFilters } from '../lib/media-api-client';
import { MediaGrid } from './media-grid';
import { useDebouncedValue } from './use-debounced-value';

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

  /*
   * What is typed lives here until it settles; the URL is written 300ms
   * later. Writing it on every keystroke meant a history entry and a
   * loader round trip per character — six of each to type "report", and
   * six presses of Back to leave the screen. The pages list wrote the
   * same lesson down before this screen existed.
   *
   * The other filters are discrete choices, not typed text, so they go
   * straight through.
   */
  const [typed, setTyped] = useState(filters.search ?? '');
  const debouncedSearch = useDebouncedValue(typed, 300);

  // The URL still wins: arriving with ?search=…, or pressing Back, puts
  // that text in the box rather than leaving what was half-typed. Adjusted
  // during render rather than in an effect, which this codebase forbids
  // for the good reason that the stale value would be painted once first.
  const [lastFromUrl, setLastFromUrl] = useState(filters.search ?? '');
  if ((filters.search ?? '') !== lastFromUrl) {
    setLastFromUrl(filters.search ?? '');
    setTyped(filters.search ?? '');
  }

  useEffect(() => {
    if ((filters.search ?? '') === debouncedSearch) {
      return;
    }
    void navigate({
      to: '/media',
      // Back to page one: the file being looked for is very unlikely to be
      // on page four of a list that has just changed shape.
      search: {
        page: 1,
        search: debouncedSearch || undefined,
        kind: filters.kind,
      },
      // One search, one history entry — not one per character.
      replace: true,
    });
  }, [debouncedSearch, filters.search, filters.kind, navigate]);

  async function goToPage(target: number) {
    await navigate({ to: '/media', search: { ...filters, page: target } });
  }

  async function changeFilters(next: MediaFilters) {
    if ((next.search ?? '') !== (filters.search ?? '')) {
      setTyped(next.search ?? '');
      return;
    }
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
        filters={{ ...filters, search: typed }}
        onFiltersChange={(next) => void changeFilters(next)}
        onPageChange={(target) => void goToPage(target)}
        showDelete
      />
    </div>
  );
}
