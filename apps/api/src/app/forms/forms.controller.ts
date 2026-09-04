import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  Body,
} from '@nestjs/common';
import {
  deleteForm,
  exportFormSubmissions,
  getFormById,
  listFormSubmissions,
  listForms,
  updateForm,
  createForm,
} from '@brisk/application';
import type { Response } from 'express';
import type { Form } from '@brisk/domain-core';
import type {
  FormRepositoryPort,
  FormSubmissionRepositoryPort,
  TenantContextPort,
} from '@brisk/ports';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { ZodValidationPipe } from '../zod-validation.pipe';
import { TENANT_CONTEXT } from '../auth/auth.tokens';
import { buildFormSubmissionsCsv } from './form-submissions-csv';
import { FORM_REPOSITORY, FORM_SUBMISSION_REPOSITORY } from './forms.tokens';
import {
  type CreateFormBody,
  createFormBodySchema,
  type ListFormsQuery,
  listFormsQuerySchema,
  type ListFormSubmissionsQuery,
  listFormSubmissionsQuerySchema,
  type UpdateFormBody,
  updateFormBodySchema,
} from './forms.schemas';

@Controller('forms')
@UseGuards(SessionAuthGuard)
export class FormsController {
  constructor(
    @Inject(FORM_REPOSITORY)
    private readonly formRepository: FormRepositoryPort,
    @Inject(FORM_SUBMISSION_REPOSITORY)
    private readonly formSubmissionRepository: FormSubmissionRepositoryPort,
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

  /**
   * One form's submissions. Behind the same session guard as the rest of
   * this controller — the payloads are whatever visitors typed into a
   * public form, which is exactly the kind of data that must not be
   * readable without being logged in.
   *
   * Returns the form alongside them: a payload is keyed by field id and is
   * unreadable without the field definitions to render it against.
   */
  @Get(':id/submissions')
  async listSubmissions(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(listFormSubmissionsQuerySchema))
    query: ListFormSubmissionsQuery,
  ) {
    const result = await listFormSubmissions(
      {
        formRepository: this.formRepository,
        formSubmissionRepository: this.formSubmissionRepository,
      },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        formId: id,
        page: query.page,
        pageSize: query.pageSize,
      },
    );
    return {
      items: result.items.map((submission) => {
        const props = submission.toProps();
        return {
          id: props.id,
          payload: props.payload,
          createdAt: props.createdAt.toISOString(),
        };
      }),
      total: result.total,
      fields: result.form.toProps().fields,
    };
  }

  /**
   * The same data as a file. A separate route rather than a query param on
   * the one above: it answers with a different content type and a
   * different pagination story (all of it), and conflating the two makes
   * both harder to reason about.
   */
  @Get(':id/submissions.csv')
  async exportSubmissions(
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    const { form, submissions } = await exportFormSubmissions(
      {
        formRepository: this.formRepository,
        formSubmissionRepository: this.formSubmissionRepository,
      },
      { tenantId: this.tenantContext.getCurrentTenantId(), formId: id },
    );

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      // The form's own name would be friendlier and is not worth the
      // escaping: it is user-supplied text going into a header, and a
      // quote or a newline there is a header-injection bug.
      `attachment; filename="submissions-${id}.csv"`,
    );
    return buildFormSubmissionsCsv(form, submissions);
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
   * Security review 2026-08-24, second backend pass: unlike
   * UsersController/MediaController (which already had an explicit
   * whitelist), this controller returned a raw form.toProps() — there is no
   * sensitive field on Form today, but without a whitelist a future field
   * would be exposed automatically, with nobody here noticing.
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
