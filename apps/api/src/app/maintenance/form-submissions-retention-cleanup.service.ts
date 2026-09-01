import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { deleteExpiredFormSubmissions, type BriskDb } from '@brisk/postgres-db';

/**
 * Single tenant assumed (docs/adr/0010), same as ExpiredTokensCleanupService
 * — a genuinely multi-tenant deployment would need to iterate every tenant
 * here instead. Per-site opt-in (`sites.form_submission_retention_days`,
 * `null` by default = never deletes anything for that site) — see
 * deleteExpiredFormSubmissions's own doc comment.
 */
@Injectable()
export class FormSubmissionsRetentionCleanupService {
  private readonly logger = new Logger(
    FormSubmissionsRetentionCleanupService.name,
  );

  constructor(
    private readonly db: BriskDb,
    private readonly tenantId: string,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async cleanupExpiredFormSubmissions(): Promise<void> {
    const { deletedSubmissions } = await deleteExpiredFormSubmissions(
      this.db,
      this.tenantId,
    );

    this.logger.log(
      `Cleaned up ${deletedSubmissions} expired form submission(s)`,
    );
  }
}
