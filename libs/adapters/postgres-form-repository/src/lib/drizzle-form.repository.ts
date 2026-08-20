import { and, count, desc, eq } from 'drizzle-orm';
import { Form, type FormProps } from '@brisk/domain-core';
import type {
  FormRepositoryPort,
  PaginatedResult,
  Pagination,
} from '@brisk/ports';
import { type BriskDb, forms, withTenant } from '@brisk/postgres-db';

function toRow(props: FormProps) {
  return {
    id: props.id,
    tenantId: props.tenantId,
    siteId: props.siteId,
    name: props.name,
    fields: props.fields,
    steps: props.steps,
    notificationEmail: props.notificationEmail,
    createdAt: props.createdAt,
    updatedAt: props.updatedAt,
  };
}

function fromRow(row: typeof forms.$inferSelect): Form {
  return Form.fromProps(row);
}

/** Connects as `brisk_app` — see docs/adr/0002-non-superuser-role-for-rls-enforcement.md. */
export class DrizzleFormRepository implements FormRepositoryPort {
  constructor(private readonly db: BriskDb) {}

  async save(form: Form): Promise<void> {
    const row = toRow(form.toProps());
    await withTenant(this.db, row.tenantId, (tx) =>
      tx
        .insert(forms)
        .values(row)
        .onConflictDoUpdate({ target: forms.id, set: row }),
    );
  }

  async findById(tenantId: string, formId: string): Promise<Form | null> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(forms)
        .where(and(eq(forms.tenantId, tenantId), eq(forms.id, formId)))
        .limit(1),
    );
    return rows[0] ? fromRow(rows[0]) : null;
  }

  /** Most recently updated first — matches the pages/media list ordering convention. */
  async listBySite(
    tenantId: string,
    siteId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<Form>> {
    const siteScope = and(
      eq(forms.tenantId, tenantId),
      eq(forms.siteId, siteId),
    );
    const [rows, [{ total }]] = await withTenant(this.db, tenantId, (tx) =>
      Promise.all([
        tx
          .select()
          .from(forms)
          .where(siteScope)
          .orderBy(desc(forms.updatedAt))
          .limit(pagination.pageSize)
          .offset((pagination.page - 1) * pagination.pageSize),
        tx.select({ total: count() }).from(forms).where(siteScope),
      ]),
    );
    return { items: rows.map(fromRow), total };
  }

  async delete(tenantId: string, formId: string): Promise<void> {
    await withTenant(this.db, tenantId, (tx) =>
      tx
        .delete(forms)
        .where(and(eq(forms.tenantId, tenantId), eq(forms.id, formId))),
    );
  }
}
