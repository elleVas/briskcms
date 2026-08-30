import { createFileRoute } from '@tanstack/react-router';
import { formQueryOptions } from '../app/forms-queries';
import { FormEditorView } from '../app/form-editor-view';
import { requireAuth } from './-require-auth';

// Unlike pages.$pageId (fullscreen Puck canvas, outside the shell), the form
// editor is just a settings-style form (name, fields, notification email) —
// small enough that keeping the sidebar visible makes more sense than going
// fullscreen for it.
export const Route = createFileRoute('/_shell/forms/$formId')({
  loader: ({ context, params }) =>
    requireAuth(() =>
      context.queryClient.ensureQueryData(formQueryOptions(params.formId)),
    ),
  component: FormEditorRoute,
});

function FormEditorRoute() {
  const { formId } = Route.useParams();
  return <FormEditorView key={formId} formId={formId} />;
}
