import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { mediaQueryOptions } from '../app/media-queries';
import { MediaLibraryView } from '../app/media-library-view';
import { requireAuth } from './-require-auth';

const DEFAULT_SITE_ID = import.meta.env['VITE_DEFAULT_SITE_ID'] as string;

// Same reasoning as pagesListSearchSchema (routes/_shell.pages.index.tsx):
// keeps `page` optional at the type level for every plain <Link to="/media">
// and falls back cleanly on a garbled value (?page=abc).
const mediaListSearchSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).catch(1),
});

export const Route = createFileRoute('/_shell/media/')({
  validateSearch: mediaListSearchSchema,
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: ({ context, deps }) =>
    requireAuth(() =>
      context.queryClient.ensureQueryData(
        mediaQueryOptions(DEFAULT_SITE_ID, deps.page),
      ),
    ),
  component: MediaLibraryRoute,
});

function MediaLibraryRoute() {
  const { page } = Route.useSearch();
  const { data } = useSuspenseQuery(mediaQueryOptions(DEFAULT_SITE_ID, page));

  return (
    <MediaLibraryView
      siteId={DEFAULT_SITE_ID}
      items={data.items}
      page={page}
      total={data.total}
    />
  );
}
