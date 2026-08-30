import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { formsQueryOptions } from '../app/forms-queries';
import { FormsListView } from '../app/forms-list-view';
import { requireAuth } from './-require-auth';

const DEFAULT_SITE_ID = import.meta.env['VITE_DEFAULT_SITE_ID'] as string;

// Same reasoning as pagesListSearchSchema (routes/_shell.pages.index.tsx).
const formsListSearchSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).catch(1),
});

export const Route = createFileRoute('/_shell/forms/')({
  validateSearch: formsListSearchSchema,
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: ({ context, deps }) =>
    requireAuth(() =>
      context.queryClient.ensureQueryData(
        formsQueryOptions(DEFAULT_SITE_ID, deps.page),
      ),
    ),
  component: FormsListRoute,
});

function FormsListRoute() {
  const { page } = Route.useSearch();
  const { data } = useSuspenseQuery(formsQueryOptions(DEFAULT_SITE_ID, page));

  return (
    <FormsListView
      siteId={DEFAULT_SITE_ID}
      forms={data.items}
      page={page}
      total={data.total}
    />
  );
}
