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
  // In the URL rather than in component state, for the same reason as the
  // page number above it: a search worth doing is a search worth reloading
  // into and sending to somebody.
  // The same 200 the API enforces (media.schemas.ts): without it, pasting
  // something longer turned a search into a 400 in the error boundary
  // instead of "nothing matches".
  search: z.string().max(200).optional().catch(undefined),
  kind: z.enum(['image', 'video', 'audio']).optional().catch(undefined),
});

export const Route = createFileRoute('/_shell/media/')({
  validateSearch: mediaListSearchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page,
    filters: { search: search.search, kind: search.kind },
  }),
  // The site is resolved first because its id is what scopes the list —
  // one extra await, not one extra request: the entry is shared with every
  // other screen.
  loader: ({ context, deps }) =>
    requireAuth(async () => {
      const site =
        await context.queryClient.ensureQueryData(siteQueryOptions());
      await context.queryClient.ensureQueryData(
        mediaQueryOptions(site.id, deps.page, deps.filters),
      );
    }),
  component: MediaLibraryRoute,
});

function MediaLibraryRoute() {
  const { page, search, kind } = Route.useSearch();
  const filters = { search, kind };
  const { data: site } = useSuspenseQuery(siteQueryOptions());
  const { data } = useSuspenseQuery(mediaQueryOptions(site.id, page, filters));

  return (
    <MediaLibraryView
      siteId={site.id}
      items={data.items}
      page={page}
      total={data.total}
      filters={filters}
    />
  );
}
