import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { CookieBannerView } from '../app/cookie-banner-view';
import { siteQueryOptions } from '../app/site-queries';
import { requireAuth } from './-require-auth';

export const Route = createFileRoute('/_shell/cookies/')({
  loader: ({ context }) =>
    requireAuth(() => context.queryClient.ensureQueryData(siteQueryOptions())),
  component: CookiesRoute,
});

function CookiesRoute() {
  const { data: site } = useSuspenseQuery(siteQueryOptions());

  return <CookieBannerView siteId={site.id} site={site} />;
}
