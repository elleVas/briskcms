import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { mediaQueryOptions } from '../app/media-queries';
import { MediaLibraryView } from '../app/media-library-view';
import { siteQueryOptions } from '../app/site-queries';
import { requireAuth } from './-require-auth';

// Same reasoning as pagesListSearchSchema (routes/_shell.pages.index.tsx):
// keeps `page` optional at the type level for every plain <Link to="/media">
// and falls back cleanly on a garbled value (?page=abc).
const mediaListSearchSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).catch(1),
});

export const Route = createFileRoute('/_shell/media/')({
  validateSearch: mediaListSearchSchema,
  loaderDeps: ({ search }) => ({ page: search.page }),
  // The site is resolved first because its id is what scopes the list —
  // one extra await, not one extra request: the entry is shared with every
  // other screen.
  loader: ({ context, deps }) =>
    requireAuth(async () => {
      const site =
        await context.queryClient.ensureQueryData(siteQueryOptions());
      await context.queryClient.ensureQueryData(
        mediaQueryOptions(site.id, deps.page),
      );
    }),
  component: MediaLibraryRoute,
});

function MediaLibraryRoute() {
  const { page } = Route.useSearch();
  const { data: site } = useSuspenseQuery(siteQueryOptions());
  const { data } = useSuspenseQuery(mediaQueryOptions(site.id, page));

  return (
    <MediaLibraryView
      siteId={site.id}
      items={data.items}
      page={page}
      total={data.total}
    />
  );
}
