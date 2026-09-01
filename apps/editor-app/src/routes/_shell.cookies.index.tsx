import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { CookieBannerView } from '../app/cookie-banner-view';
import { siteQueryOptions } from '../app/site-queries';
import { requireAuth } from './-require-auth';

const DEFAULT_SITE_ID = import.meta.env['VITE_DEFAULT_SITE_ID'] as string;

export const Route = createFileRoute('/_shell/cookies/')({
  loader: ({ context }) =>
    requireAuth(() =>
      context.queryClient.ensureQueryData(siteQueryOptions(DEFAULT_SITE_ID)),
    ),
  component: CookiesRoute,
});

function CookiesRoute() {
  const { data: site } = useSuspenseQuery(siteQueryOptions(DEFAULT_SITE_ID));

  return <CookieBannerView siteId={DEFAULT_SITE_ID} site={site} />;
}
