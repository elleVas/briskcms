import { FormNotFoundError } from '@brisk/domain-core';
import type { Form, FormSubmission } from '@brisk/domain-core';
import type {
  FormRepositoryPort,
  FormSubmissionRepositoryPort,
  PaginatedResult,
} from '@brisk/ports';

export interface ListFormSubmissionsDeps {
  formRepository: FormRepositoryPort;
  formSubmissionRepository: FormSubmissionRepositoryPort;
}

export interface ListFormSubmissionsInput {
  tenantId: string;
  formId: string;
  page: number;
  pageSize: number;
}

export interface ListFormSubmissionsResult extends PaginatedResult<FormSubmission> {
  /**
   * The form as it stands *now*, returned alongside its submissions
   * because a payload is keyed by field id and is unreadable without it.
   *
   * "As it stands now" is the honest caveat: fields get renamed and
   * removed, so a submission can carry keys this form no longer has. That
   * is not a defect to hide — it is a real thing that happened, and the
   * caller is expected to show those values rather than drop them.
   */
  form: Form;
}

/**
 * The read side of the form builder. It existed only as a write path until
 * now: submissions were stored and emailed, and there was no way to look
 * at them again afterwards.
 *
 * Loads the form first, so a request for a form that is not this tenant's
 * fails as "not found" before any submission is read — the submissions
 * table is scoped by tenant too, but the form is the thing being asked
 * about, and it should be the thing that decides.
 */
export async function listFormSubmissions(
  deps: ListFormSubmissionsDeps,
  input: ListFormSubmissionsInput,
): Promise<ListFormSubmissionsResult> {
  const form = await deps.formRepository.findById(input.tenantId, input.formId);
  if (!form) {
    throw new FormNotFoundError(input.formId);
  }

  const { items, total } = await deps.formSubmissionRepository.listByForm(
    input.tenantId,
    input.formId,
    { page: input.page, pageSize: input.pageSize },
  );

  return { items, total, form };
}

export interface ExportFormSubmissionsResult {
  form: Form;
  submissions: FormSubmission[];
}

/** Every submission for one form, for the CSV export. Same ownership check. */
export async function exportFormSubmissions(
  deps: ListFormSubmissionsDeps,
  input: { tenantId: string; formId: string },
): Promise<ExportFormSubmissionsResult> {
  const form = await deps.formRepository.findById(input.tenantId, input.formId);
  if (!form) {
    throw new FormNotFoundError(input.formId);
  }

  return {
    form,
    submissions: await deps.formSubmissionRepository.listAllByForm(
      input.tenantId,
      input.formId,
    ),
  };
}
