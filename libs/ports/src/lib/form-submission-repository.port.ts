import type { FormSubmission } from '@brisk/domain-core';

export interface FormSubmissionRepositoryPort {
  save(submission: FormSubmission): Promise<void>;
}
