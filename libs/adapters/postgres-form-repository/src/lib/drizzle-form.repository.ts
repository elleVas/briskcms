import { and, eq } from 'drizzle-orm';
import { Form, type FormProps } from '@brisk/domain-core';
import type {
  FormRepositoryPort,
  PaginatedResult,
  Pagination,
} from '@brisk/ports';
import {
  DrizzlePaginatedRepository,
  type BriskDb,
  forms,
} from '@brisk/postgres-db';

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
export class DrizzleFormRepository
  extends DrizzlePaginatedRepository<typeof forms.$inferSelect, Form>
  implements FormRepositoryPort
{
  protected readonly table = forms;
  protected readonly idColumn = forms.id;
  protected readonly tenantIdColumn = forms.tenantId;

  constructor(db: BriskDb) {
    super(db);
  }

  protected toRow(form: Form) {
    return toRow(form.toProps());
  }

  protected fromRow(row: typeof forms.$inferSelect): Form {
    return fromRow(row);
  }

  /** Most recently updated first — matches the pages/media list ordering convention. */
  async listBySite(
    tenantId: string,
    siteId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<Form>> {
    return this.listPaginatedTx(
      tenantId,
      and(eq(forms.tenantId, tenantId), eq(forms.siteId, siteId)),
      forms.updatedAt,
      pagination,
    );
  }
}
