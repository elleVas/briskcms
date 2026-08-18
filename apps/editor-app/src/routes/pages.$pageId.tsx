import { createFileRoute, redirect } from '@tanstack/react-router';
import { PageEditorView } from '../app/page-editor-view.js';
import { ApiError } from '../lib/http-client.js';
import { getPage } from '../lib/pages-api-client.js';

export const Route = createFileRoute('/pages/$pageId')({
  loader: async ({ params }) => {
    try {
      return await getPage(params.pageId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        throw redirect({ to: '/login' });
      }
      throw error;
    }
  },
  component: PageEditorRoute,
});

function PageEditorRoute() {
  const page = Route.useLoaderData();
  const { pageId } = Route.useParams();
  return <PageEditorView key={pageId} page={page} />;
}
