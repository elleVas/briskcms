import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { LegalDocumentsWizard } from '../app/legal-documents-wizard';
import { siteQueryOptions } from '../app/site-queries';
import { requireAuth } from './-require-auth';

export const Route = createFileRoute('/_shell/cookies/legal-documents')({
  loader: ({ context }) =>
    requireAuth(() => context.queryClient.ensureQueryData(siteQueryOptions())),
  component: LegalDocumentsRoute,
});

function LegalDocumentsRoute() {
  const { data: site } = useSuspenseQuery(siteQueryOptions());

  return <LegalDocumentsWizard siteId={site.id} site={site} />;
}
