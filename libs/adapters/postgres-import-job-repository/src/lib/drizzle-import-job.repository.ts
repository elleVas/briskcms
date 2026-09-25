import { and, desc, eq } from 'drizzle-orm';
import { ImportJob, type ImportJobProps } from '@brisk/domain-core';
import type { ImportJobRepositoryPort } from '@brisk/ports';
import { type BriskDb, importJobs, withTenant } from '@brisk/postgres-db';

function toEntity(row: typeof importJobs.$inferSelect): ImportJob {
  return ImportJob.fromProps({
    id: row.id,
    tenantId: row.tenantId,
    siteId: row.siteId,
    source: row.source,
    fileName: row.fileName,
    fileBytes: row.fileBytes,
    status: row.status,
    report: row.report ?? null,
    failureReason: row.failureReason,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    finishedAt: row.finishedAt,
  });
}

function toRow(props: ImportJobProps) {
  return {
    id: props.id,
    tenantId: props.tenantId,
    siteId: props.siteId,
    source: props.source,
    fileName: props.fileName,
    fileBytes: props.fileBytes,
    status: props.status,
    report: props.report,
    failureReason: props.failureReason,
    createdBy: props.createdBy,
    createdAt: props.createdAt,
    finishedAt: props.finishedAt,
  };
}

export class DrizzleImportJobRepository implements ImportJobRepositoryPort {
  constructor(private readonly db: BriskDb) {}

  async save(job: ImportJob): Promise<void> {
    const row = toRow(job.toProps());
    await withTenant(this.db, row.tenantId, (tx) =>
      tx
        .insert(importJobs)
        .values(row)
        .onConflictDoUpdate({
          target: importJobs.id,
          set: {
            status: row.status,
            report: row.report,
            failureReason: row.failureReason,
            finishedAt: row.finishedAt,
          },
        }),
    );
  }

  async findById(tenantId: string, id: string): Promise<ImportJob | null> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(importJobs)
        .where(and(eq(importJobs.tenantId, tenantId), eq(importJobs.id, id)))
        .limit(1),
    );
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async listBySite(tenantId: string, siteId: string): Promise<ImportJob[]> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(importJobs)
        .where(
          and(eq(importJobs.tenantId, tenantId), eq(importJobs.siteId, siteId)),
        )
        .orderBy(desc(importJobs.createdAt)),
    );
    return rows.map(toEntity);
  }

  async listRunning(tenantId: string): Promise<ImportJob[]> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(importJobs)
        .where(
          and(
            eq(importJobs.tenantId, tenantId),
            eq(importJobs.status, 'analyzing'),
          ),
        ),
    );
    return rows.map(toEntity);
  }
}
