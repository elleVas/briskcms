import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  createForm,
  deleteForm,
  getFormById,
  listForms,
  updateForm,
} from '@brisk/application';
import type { Form } from '@brisk/domain-core';
import type { FormRepositoryPort, TenantContextPort } from '@brisk/ports';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { ZodValidationPipe } from '../zod-validation.pipe';
import { TENANT_CONTEXT } from '../auth/auth.tokens';
import { FORM_REPOSITORY } from './forms.tokens';
import {
  type CreateFormBody,
  createFormBodySchema,
  type ListFormsQuery,
  listFormsQuerySchema,
  type UpdateFormBody,
  updateFormBodySchema,
} from './forms.schemas';

@Controller('forms')
@UseGuards(SessionAuthGuard)
export class FormsController {
  constructor(
    @Inject(FORM_REPOSITORY)
    private readonly formRepository: FormRepositoryPort,
    @Inject(TENANT_CONTEXT) private readonly tenantContext: TenantContextPort,
  ) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createFormBodySchema)) body: CreateFormBody,
  ) {
    const form = await createForm(
      { formRepository: this.formRepository },
      { tenantId: this.tenantContext.getCurrentTenantId(), ...body },
    );
    return this.toDto(form);
  }

  @Get()
  async list(
    @Query(new ZodValidationPipe(listFormsQuerySchema)) query: ListFormsQuery,
  ) {
    const result = await listForms(
      { formRepository: this.formRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        siteId: query.siteId,
        page: query.page,
        pageSize: query.pageSize,
      },
    );
    return {
      items: result.items.map((form) => this.toDto(form)),
      total: result.total,
    };
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const form = await getFormById(
      { formRepository: this.formRepository },
      { tenantId: this.tenantContext.getCurrentTenantId(), formId: id },
    );
    return this.toDto(form);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateFormBodySchema)) body: UpdateFormBody,
  ) {
    const form = await updateForm(
      { formRepository: this.formRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        formId: id,
        ...body,
      },
    );
    return this.toDto(form);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    await deleteForm(
      { formRepository: this.formRepository },
      { tenantId: this.tenantContext.getCurrentTenantId(), formId: id },
    );
  }

  /**
   * Security review 2026-08-24, backend seconda passata: a differenza di
   * UsersController/MediaController (whitelist esplicita già presente),
   * questo controller restituiva form.toProps() grezzo — nessun campo
   * sensibile su Form oggi, ma senza whitelist un futuro campo lo
   * esporrebbe automaticamente, senza che nessuno se ne accorga qui.
   */
  private toDto(form: Form) {
    const props = form.toProps();
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
}
