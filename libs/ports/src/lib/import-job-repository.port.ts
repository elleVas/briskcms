import type { ImportJob } from '@brisk/domain-core';

export interface ImportJobRepositoryPort {
  save(job: ImportJob): Promise<void>;
  findById(tenantId: string, id: string): Promise<ImportJob | null>;
  /** Newest first — the only order this table is ever read in. */
  listBySite(tenantId: string, siteId: string): Promise<ImportJob[]>;
  /**
   * Every job still marked as running, across every site of this tenant.
   *
   * For the sweep at start-up: the work happens in the API process, so a
   * job that was running when it stopped has nobody doing it any more
   * and would otherwise be watched forever.
   */
  listRunning(tenantId: string): Promise<ImportJob[]>;
}
