import { and, count, desc, eq } from 'drizzle-orm';
import { FormSubmission, type FormSubmissionProps } from '@brisk/domain-core';
import type {
  FormSubmissionRepositoryPort,
  PaginatedResult,
  Pagination,
} from '@brisk/ports';
import { type BriskDb, formSubmissions, withTenant } from '@brisk/postgres-db';

function toEntity(row: typeof formSubmissions.$inferSelect): FormSubmission {
  return FormSubmission.fromProps({
    id: row.id,
    tenantId: row.tenantId,
    siteId: row.siteId,
    pageId: row.pageId,
    formId: row.formId,
    payload: row.payload as Record<string, unknown>,
    createdAt: row.createdAt,
  });
}

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

  async listByForm(
    tenantId: string,
    formId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<FormSubmission>> {
    // Not DrizzlePaginatedRepository: that base is built around a
    // tenant-scoped entity with its own id/save/delete surface, and this
    // one is read-and-append only — inheriting it would mean implementing
    // three abstract hooks nothing calls.
    return withTenant(this.db, tenantId, async (tx) => {
      const where = and(
        eq(formSubmissions.tenantId, tenantId),
        eq(formSubmissions.formId, formId),
      );
      const [rows, [totals]] = await Promise.all([
        tx
          .select()
          .from(formSubmissions)
          .where(where)
          // Newest first: an admin opening this is looking for what just
          // came in, not for the oldest thing on record.
          .orderBy(desc(formSubmissions.createdAt))
          .limit(pagination.pageSize)
          .offset((pagination.page - 1) * pagination.pageSize),
        tx.select({ value: count() }).from(formSubmissions).where(where),
      ]);
      return { items: rows.map(toEntity), total: totals?.value ?? 0 };
    });
  }

  async listAllByForm(
    tenantId: string,
    formId: string,
  ): Promise<FormSubmission[]> {
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(formSubmissions)
        .where(
          and(
            eq(formSubmissions.tenantId, tenantId),
            eq(formSubmissions.formId, formId),
          ),
        )
        // Oldest first for the export: a spreadsheet reads top-to-bottom as
        // a timeline, which is the opposite of what the screen wants.
        .orderBy(formSubmissions.createdAt);
      return rows.map(toEntity);
    });
  }
}
