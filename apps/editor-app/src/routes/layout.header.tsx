import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { siteLayoutSectionQueryOptions } from '../app/site-layout-sections-queries.js';
import { siteQueryOptions } from '../app/site-queries.js';
import { SiteLayoutSectionEditorView } from '../app/site-layout-section-editor-view.js';
import { requireAuth } from './-require-auth.js';

const DEFAULT_SITE_ID = import.meta.env['VITE_DEFAULT_SITE_ID'] as string;

// Optional, not required: a direct visit with no `locale` in the URL still
// works, falling back to the site's own defaultLocale (loaded below) —
// same reasoning as layoutSearchSchema on the index route.
const layoutHeaderSearchSchema = z.object({
  locale: z.string().min(2).optional(),
});

export const Route = createFileRoute('/layout/header')({
  validateSearch: layoutHeaderSearchSchema,
  loaderDeps: ({ search }) => ({ locale: search.locale }),
  loader: ({ context, deps }) =>
    requireAuth(async () => {
      const site = await context.queryClient.ensureQueryData(
        siteQueryOptions(DEFAULT_SITE_ID),
      );
      const locale = deps.locale ?? site.defaultLocale;
      await context.queryClient.ensureQueryData(
        siteLayoutSectionQueryOptions(DEFAULT_SITE_ID, locale, 'header'),
      );
    }),
  component: LayoutHeaderRoute,
});

function LayoutHeaderRoute() {
  const { locale: searchLocale } = Route.useSearch();
  const { data: site } = useSuspenseQuery(siteQueryOptions(DEFAULT_SITE_ID));
  const locale = searchLocale ?? site.defaultLocale;

  return (
    <SiteLayoutSectionEditorView
      key={locale}
      siteId={DEFAULT_SITE_ID}
      locale={locale}
      kind="header"
    />
  );
}
