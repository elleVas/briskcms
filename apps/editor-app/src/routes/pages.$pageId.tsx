import { createFileRoute } from '@tanstack/react-router';
import { pageQueryOptions } from '../app/pages-queries.js';
import { PageEditorView } from '../app/page-editor-view.js';
import { requireAuth } from './-require-auth.js';

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
