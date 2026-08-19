import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { AppearanceView } from '../app/appearance-view.js';
import { siteQueryOptions } from '../app/site-queries.js';
import { requireAuth } from './-require-auth.js';

const DEFAULT_SITE_ID = import.meta.env['VITE_DEFAULT_SITE_ID'] as string;

// `locale` is optional (falls back to the site's own defaultLocale once
// loaded, see below) so a bare <Link to="/appearance"> stays valid at the
// type level, same reasoning as pagesListSearchSchema's `page`.
const appearanceSearchSchema = z.object({
  locale: z.string().min(2).optional(),
});

export const Route = createFileRoute('/_shell/appearance/')({
  validateSearch: appearanceSearchSchema,
  loader: ({ context }) =>
    requireAuth(() =>
      context.queryClient.ensureQueryData(siteQueryOptions(DEFAULT_SITE_ID)),
    ),
  component: AppearanceRoute,
});

function AppearanceRoute() {
  const { locale } = Route.useSearch();
  const { data: site } = useSuspenseQuery(siteQueryOptions(DEFAULT_SITE_ID));

  return (
    <AppearanceView
      enabledLocales={site.enabledLocales}
      locale={locale ?? site.defaultLocale}
    />
  );
}
