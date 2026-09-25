import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import type { MediaKind } from '@brisk/shared-types';
import type { MediaRecord, MediaFilters } from '../lib/media-api-client';
import { MediaFilterBar } from './media-filter-bar';
import { MEDIA_KIND_LABEL, MediaFolders } from './media-folders';
import { MediaGrid } from './media-grid';
import { MediaUploadButton, MediaUploadWarning } from './media-upload';
import { useDebouncedValue } from './use-debounced-value';

export interface MediaLibraryViewProps {
  siteId: string;
  items: MediaRecord[];
  page: number;
  total: number;
  /** In the URL, like the pages list's own: a search worth doing is a search worth reloading into and sending to somebody. */
  filters: MediaFilters;
  /** How many files each folder holds — what the front door shows. */
  counts: Record<MediaKind, number>;
}

export function MediaLibraryView({
  siteId,
  items,
  page,
  total,
  filters,
  counts,
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

  const [uploadError, setUploadError] = useState('');
  const searchFilters = { ...filters, search: typed };

  /*
   * Three screens behind one address:
   * - nothing chosen: the folders, with search and upload above them;
   * - a folder (`?kind=`): its files, searched within it;
   * - a search typed at the front door: matches from every folder, since
   *   somebody looking for "listino" should not have to guess where it is.
   */
  if (!filters.kind && !filters.search) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold tracking-tight">
          {t('media.list.title')}
        </h1>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <MediaFilterBar
            value={searchFilters}
            onChange={(next) => void changeFilters(next)}
            showKindChoice={false}
          />
          <MediaUploadButton siteId={siteId} onError={setUploadError} />
        </div>
        <MediaUploadWarning />
        {uploadError && (
          <p role="alert" className="text-sm text-destructive">
            {uploadError}
          </p>
        )}
        <MediaFolders counts={counts} />
      </div>
    );
  }

  const here = filters.kind
    ? t('media.folders.titleWithCount', {
        name: t(MEDIA_KIND_LABEL[filters.kind]),
        count: counts[filters.kind],
      })
    : t('media.folders.searchResults');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        {/* The way back to the folders. A breadcrumb rather than a back
            button: it says where you are as well as how to leave. */}
        <nav aria-label={t('media.folders.breadcrumb')}>
          <ol className="flex items-center gap-1 text-sm text-muted-foreground">
            <li>
              <Link
                to="/media"
                search={{ page: 1 }}
                className="hover:text-foreground hover:underline"
              >
                {t('media.list.title')}
              </Link>
            </li>
            <li aria-hidden>
              <ChevronRight className="size-3.5" />
            </li>
            <li aria-current="page" className="text-foreground">
              {filters.kind
                ? t(MEDIA_KIND_LABEL[filters.kind])
                : t('media.folders.searchResults')}
            </li>
          </ol>
        </nav>
        <h1 className="text-xl font-semibold tracking-tight">{here}</h1>
      </div>
      <MediaGrid
        siteId={siteId}
        items={items}
        page={page}
        total={total}
        filters={searchFilters}
        onFiltersChange={(next) => void changeFilters(next)}
        onPageChange={(target) => void goToPage(target)}
        lockedKind={filters.kind}
        showKindChoice={false}
        showDelete
      />
    </div>
  );
}
