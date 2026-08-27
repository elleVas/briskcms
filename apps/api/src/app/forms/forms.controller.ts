import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  createForm,
  deleteForm,
  listForms,
  updateForm,
} from '@brisk/application';
import type { FormRepositoryPort, TenantContextPort } from '@brisk/ports';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import { TENANT_CONTEXT } from '../auth/auth.tokens.js';
import { FORM_REPOSITORY } from './forms.tokens.js';
import {
  type CreateFormBody,
  createFormBodySchema,
  type ListFormsQuery,
  listFormsQuerySchema,
  type UpdateFormBody,
  updateFormBodySchema,
} from './forms.schemas.js';

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
    return form.toProps();
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
      items: result.items.map((form) => form.toProps()),
      total: result.total,
    };
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const form = await this.formRepository.findById(
      this.tenantContext.getCurrentTenantId(),
      id,
    );
    if (!form) {
      throw new NotFoundException(`Form not found: ${id}`);
    }
    return form.toProps();
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
    return form.toProps();
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    await deleteForm(
      { formRepository: this.formRepository },
      { tenantId: this.tenantContext.getCurrentTenantId(), formId: id },
    );
  }
}
