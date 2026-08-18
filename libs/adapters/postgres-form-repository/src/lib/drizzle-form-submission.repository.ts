import { FormSubmission, type FormSubmissionProps } from '@brisk/domain-core';
import type { FormSubmissionRepositoryPort } from '@brisk/ports';
import { type BriskDb, formSubmissions, withTenant } from '@brisk/postgres-db';

function toRow(props: FormSubmissionProps) {
  return {
    id: props.id,
    tenantId: props.tenantId,
    siteId: props.siteId,
    pageId: props.pageId,
    formId: props.formId,
    payload: props.payload,
    createdAt: props.createdAt,
  };
}

/** Connects as `brisk_app` — see docs/adr/0002-non-superuser-role-for-rls-enforcement.md. */
export class DrizzleFormSubmissionRepository implements FormSubmissionRepositoryPort {
  constructor(private readonly db: BriskDb) {}

  async save(submission: FormSubmission): Promise<void> {
    const row = toRow(submission.toProps());
    await withTenant(this.db, row.tenantId, (tx) =>
      tx.insert(formSubmissions).values(row),
    );
  }
}
