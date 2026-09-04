import type { FormSubmission } from '@brisk/domain-core';
import type { Pagination, PaginatedResult } from './pagination';

export interface FormSubmissionRepositoryPort {
  save(submission: FormSubmission): Promise<void>;

  /**
   * One form's submissions, newest first. Paginated for the admin list.
   *
   * Scoped to a form rather than to a site: submissions are only ever read
   * in the context of the form that produced them, because a payload is
   * keyed by field id and means nothing without that form's field
   * definitions to read it against.
   */
  listByForm(
    tenantId: string,
    formId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<FormSubmission>>;

  /**
   * Every submission for a form, unpaginated — the export.
   *
   * Deliberately separate from `listByForm` rather than "the same call
   * with a huge pageSize": a caller that wants a page and a caller that
   * wants a file are asking different questions, and one of them must not
   * be reachable by accident from the admin list's own pagination
   * controls.
   */
  listAllByForm(tenantId: string, formId: string): Promise<FormSubmission[]>;
}
