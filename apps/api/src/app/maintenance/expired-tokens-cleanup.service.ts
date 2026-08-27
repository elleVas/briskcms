import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { deleteExpiredTokens, type BriskDb } from '@brisk/postgres-db';

/**
 * Single tenant assumed (docs/adr/0010, same as `bootstrapTenantId` on
 * SessionAuthAdapter/VerificationTokenAdapter) — a genuinely multi-tenant
 * deployment would need to iterate every tenant here instead. See
 * deleteExpiredTokens's own doc comment for why sessions/verification_tokens
 * need this at all.
 */
@Injectable()
export class ExpiredTokensCleanupService {
  private readonly logger = new Logger(ExpiredTokensCleanupService.name);

  constructor(
    private readonly db: BriskDb,
    private readonly tenantId: string,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredTokens(): Promise<void> {
    const { deletedSessions, deletedVerificationTokens } =
      await deleteExpiredTokens(this.db, this.tenantId);

    this.logger.log(
      `Cleaned up ${deletedSessions} expired session(s) and ${deletedVerificationTokens} expired verification token(s)`,
    );
  }
}
