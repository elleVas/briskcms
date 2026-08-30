import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { LayoutView } from '../app/layout-view';
import { siteQueryOptions } from '../app/site-queries';
import { requireAuth } from './-require-auth';

const DEFAULT_SITE_ID = import.meta.env['VITE_DEFAULT_SITE_ID'] as string;

// `locale` is optional (falls back to the site's own defaultLocale once
// loaded, see below) so a bare <Link to="/layout"> stays valid at the
// type level, same reasoning as pagesListSearchSchema's `page`.
const layoutSearchSchema = z.object({
  locale: z.string().min(2).optional(),
});

export const Route = createFileRoute('/_shell/layout/')({
  validateSearch: layoutSearchSchema,
  loader: ({ context }) =>
    requireAuth(() =>
      context.queryClient.ensureQueryData(siteQueryOptions(DEFAULT_SITE_ID)),
    ),
  component: LayoutRoute,
});

function LayoutRoute() {
  const { locale } = Route.useSearch();
  const { data: site } = useSuspenseQuery(siteQueryOptions(DEFAULT_SITE_ID));

  return (
    <LayoutView
      enabledLocales={site.enabledLocales}
      locale={locale ?? site.defaultLocale}
    />
  );
}
