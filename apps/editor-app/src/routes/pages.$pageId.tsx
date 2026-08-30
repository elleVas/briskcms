import { createFileRoute } from '@tanstack/react-router';
import { pageQueryOptions } from '../app/pages-queries';
import { PageEditorView } from '../app/page-editor-view';
import { requireAuth } from './-require-auth';

export const Route = createFileRoute('/pages/$pageId')({
  loader: ({ context, params }) =>
    requireAuth(() =>
      context.queryClient.ensureQueryData(pageQueryOptions(params.pageId)),
    ),
  component: PageEditorRoute,
});

function PageEditorRoute() {
  const { pageId } = Route.useParams();
  return <PageEditorView key={pageId} pageId={pageId} />;
}
