import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { siteLayoutSectionQueryOptions } from '../app/site-layout-sections-queries.js';
import { siteQueryOptions } from '../app/site-queries.js';
import { SiteLayoutSectionEditorView } from '../app/site-layout-section-editor-view.js';
import { requireAuth } from './-require-auth.js';

const DEFAULT_SITE_ID = import.meta.env['VITE_DEFAULT_SITE_ID'] as string;

// Same reasoning as layout.header.tsx's own schema.
const layoutFooterSearchSchema = z.object({
  locale: z.string().min(2).optional(),
});

export const Route = createFileRoute('/layout/footer')({
  validateSearch: layoutFooterSearchSchema,
  loaderDeps: ({ search }) => ({ locale: search.locale }),
  loader: ({ context, deps }) =>
    requireAuth(async () => {
      const site = await context.queryClient.ensureQueryData(
        siteQueryOptions(DEFAULT_SITE_ID),
      );
      const locale = deps.locale ?? site.defaultLocale;
      await context.queryClient.ensureQueryData(
        siteLayoutSectionQueryOptions(DEFAULT_SITE_ID, locale, 'footer'),
      );
    }),
  component: LayoutFooterRoute,
});

function LayoutFooterRoute() {
  const { locale: searchLocale } = Route.useSearch();
  const { data: site } = useSuspenseQuery(siteQueryOptions(DEFAULT_SITE_ID));
  const locale = searchLocale ?? site.defaultLocale;

  return (
    <SiteLayoutSectionEditorView
      key={locale}
      siteId={DEFAULT_SITE_ID}
      locale={locale}
      kind="footer"
    />
  );
}
