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
import {
  type FormRecord,
  type PaginatedFormSubmissions,
  type PaginatedForms,
  formRecordSchema,
  paginatedFormSubmissionsSchema,
  paginatedFormsSchema,
} from '@brisk/shared-types';
import type {
  FormRepositoryPort,
  FormSubmissionRepositoryPort,
  PageTranslationRepositoryPort,
  TenantContextPort,
} from '@brisk/ports';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { ZodValidationPipe } from '../zod-validation.pipe';
import { TENANT_CONTEXT } from '../auth/auth.tokens';
import { buildFormSubmissionsCsv } from './form-submissions-csv';
import {
  FORM_REPOSITORY,
  FORM_SUBMISSION_REPOSITORY,
  PAGE_TRANSLATION_REPOSITORY,
} from './forms.tokens';
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
    @Inject(PAGE_TRANSLATION_REPOSITORY)
    private readonly pageTranslationRepository: PageTranslationRepositoryPort,
    @Inject(TENANT_CONTEXT) private readonly tenantContext: TenantContextPort,
  ) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createFormBodySchema)) body: CreateFormBody,
  ): Promise<FormRecord> {
    const form = await createForm(
      { formRepository: this.formRepository },
      { tenantId: this.tenantContext.getCurrentTenantId(), ...body },
    );
    // Nothing can have been submitted to a form that did not exist a
    // moment ago.
    return this.toDto(form, 0);
  }

  @Get()
  async list(
    @Query(new ZodValidationPipe(listFormsQuerySchema)) query: ListFormsQuery,
  ): Promise<PaginatedForms> {
    const result = await listForms(
      { formRepository: this.formRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        siteId: query.siteId,
        page: query.page,
        pageSize: query.pageSize,
      },
    );
    // One extra query for the whole page rather than one per row: the list
    // is where someone finds out that answers came in at all, and without
    // a number here they have to open every form to know.
    const counts = await this.formSubmissionRepository.countByForms(
      this.tenantContext.getCurrentTenantId(),
      result.items.map((form) => form.id),
    );

    return paginatedFormsSchema.parse({
      items: result.items.map((form) => this.toDto(form, counts[form.id] ?? 0)),
      total: result.total,
    });
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
  ): Promise<PaginatedFormSubmissions> {
    const result = await listFormSubmissions(
      {
        formRepository: this.formRepository,
        formSubmissionRepository: this.formSubmissionRepository,
        pageTranslationRepository: this.pageTranslationRepository,
      },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        formId: id,
        page: query.page,
        pageSize: query.pageSize,
      },
    );
    return paginatedFormSubmissionsSchema.parse({
      items: result.items.map((submission) => {
        const props = submission.toProps();
        return {
          id: props.id,
          payload: props.payload,
          createdAt: props.createdAt.toISOString(),
          // The id alone; the page is named once in `pages` below rather
          // than repeated on every row that shares it.
          pageId: props.pageId,
        };
      }),
      total: result.total,
      fields: result.form.toProps().fields,
      pages: result.pages,
    });
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
    const { form, submissions, pages } = await exportFormSubmissions(
      {
        formRepository: this.formRepository,
        formSubmissionRepository: this.formSubmissionRepository,
        pageTranslationRepository: this.pageTranslationRepository,
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
    return buildFormSubmissionsCsv(form, submissions, pages);
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<FormRecord> {
    const form = await getFormById(
      { formRepository: this.formRepository },
      { tenantId: this.tenantContext.getCurrentTenantId(), formId: id },
    );
    return this.toDto(form, await this.submissionCountOf(form));
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateFormBodySchema)) body: UpdateFormBody,
  ): Promise<FormRecord> {
    const form = await updateForm(
      { formRepository: this.formRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        formId: id,
        ...body,
      },
    );
    return this.toDto(form, await this.submissionCountOf(form));
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
   * The count travels with every form, not only with the list: the form
   * editor labels its Submissions tab with it, and after a save it keeps
   * the PATCH response as the form it shows.
   */
  private async submissionCountOf(form: Form): Promise<number> {
    const counts = await this.formSubmissionRepository.countByForms(
      this.tenantContext.getCurrentTenantId(),
      [form.id],
    );
    return counts[form.id] ?? 0;
  }

  /**
   * Whitelisted field by field, never a raw form.toProps() (security review
   * 2026-08-24): there is no sensitive field on Form today, but without a
   * whitelist a future one would be exposed automatically, with nobody
   * here noticing.
   */
  private toDto(form: Form, submissionCount: number): FormRecord {
    const props = form.toProps();
    return formRecordSchema.parse({
      id: props.id,
      tenantId: props.tenantId,
      siteId: props.siteId,
      name: props.name,
      fields: props.fields,
      steps: props.steps,
      notificationEmail: props.notificationEmail,
      createdAt: props.createdAt.toISOString(),
      updatedAt: props.updatedAt.toISOString(),
      submissionCount,
    });
  }
}
