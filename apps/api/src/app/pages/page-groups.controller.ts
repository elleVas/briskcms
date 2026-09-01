import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  createPageGroup,
  createPageGroupTranslation,
  deletePageGroup,
  divergePageTranslation,
  duplicatePageGroup,
  getPageGroupById,
  getPageTranslationById,
  listPageGroups,
  listPageGroupTranslations,
  listPageGroupVersions,
  listPageTranslationVersions,
  publishPageTranslation,
  reorderSiblingPageGroups,
  rollbackPageGroupToVersion,
  saveDivergedPageTranslationContent,
  savePageGroupContent,
  savePageTranslationFieldValues,
  updatePageTranslationSeoMeta,
} from '@brisk/application';
import type {
  PageGroup,
  PageGroupVersion,
  PageTranslation,
  PageTranslationVersion,
} from '@brisk/domain-core';
import type {
  PageGroupRepositoryPort,
  PageGroupVersionRepositoryPort,
  PageTranslationRepositoryPort,
  PageTranslationVersionRepositoryPort,
  PreviewTokenPort,
  SearchPort,
  TenantContextPort,
} from '@brisk/ports';
import {
  pageGroupRecordSchema,
  pageGroupVersionRecordSchema,
  pageTranslationRecordSchema,
  pageTranslationVersionRecordSchema,
  paginatedPageGroupsSchema,
  type PageGroupRecord,
  type PageTranslationRecord,
} from '@brisk/shared-types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { ZodValidationPipe } from '../zod-validation.pipe';
import { TENANT_CONTEXT } from '../auth/auth.tokens';
import { PREVIEW_TOKEN_TTL_MS } from '../preview-token-ttl.constant';
import {
  PAGE_GROUP_REPOSITORY,
  PAGE_GROUP_VERSION_REPOSITORY,
  PAGE_TRANSLATION_REPOSITORY,
  PAGE_TRANSLATION_VERSION_REPOSITORY,
} from './page-groups.tokens';
import { PREVIEW_TOKEN_PORT, SEARCH_REPOSITORY } from './pages.tokens';
import {
  type CreatePageGroupBody,
  createPageGroupBodySchema,
  type CreatePageGroupTranslationBody,
  createPageGroupTranslationBodySchema,
  type ListPageGroupsQuery,
  listPageGroupsQuerySchema,
  type ReorderPageGroupsBody,
  reorderPageGroupsBodySchema,
  type RollbackPageGroupBody,
  rollbackPageGroupBodySchema,
  type SaveDivergedPageTranslationContentBody,
  saveDivergedPageTranslationContentBodySchema,
  type SavePageGroupContentBody,
  savePageGroupContentBodySchema,
  type SavePageTranslationFieldValuesBody,
  savePageTranslationFieldValuesBodySchema,
  type UpdatePageTranslationSeoMetaBody,
  updatePageTranslationSeoMetaBodySchema,
} from './page-groups.schemas';

/**
 * i18n a livello di campo (vedi il piano) — struttura condivisa
 * (PageGroup) + testo per-locale (PageTranslation). Fase 5 ha rimosso
 * PagesController (vecchio modello a pagina duplicata) e le sue tabelle:
 * questo è ora l'unico controller di pagine.
 */
@Controller('page-groups')
@UseGuards(SessionAuthGuard)
export class PageGroupsController {
  constructor(
    @Inject(PAGE_GROUP_REPOSITORY)
    private readonly pageGroupRepository: PageGroupRepositoryPort,
    @Inject(PAGE_GROUP_VERSION_REPOSITORY)
    private readonly pageGroupVersionRepository: PageGroupVersionRepositoryPort,
    @Inject(PAGE_TRANSLATION_REPOSITORY)
    private readonly pageTranslationRepository: PageTranslationRepositoryPort,
    @Inject(PAGE_TRANSLATION_VERSION_REPOSITORY)
    private readonly pageTranslationVersionRepository: PageTranslationVersionRepositoryPort,
    @Inject(TENANT_CONTEXT) private readonly tenantContext: TenantContextPort,
    @Inject(PREVIEW_TOKEN_PORT)
    private readonly previewTokenPort: PreviewTokenPort,
    @Inject(SEARCH_REPOSITORY) private readonly searchPort: SearchPort,
  ) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createPageGroupBodySchema))
    body: CreatePageGroupBody,
  ) {
    const group = await createPageGroup(
      { pageGroupRepository: this.pageGroupRepository },
      {
        ...body,
        createdBy: this.tenantContext.getCurrentUserId(),
        tenantId: this.tenantContext.getCurrentTenantId(),
      },
    );
    return this.toGroupDto(group);
  }

  @Get()
  async list(
    @Query(new ZodValidationPipe(listPageGroupsQuerySchema))
    query: ListPageGroupsQuery,
  ) {
    const result = await listPageGroups(
      { pageGroupRepository: this.pageGroupRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        siteId: query.siteId,
        page: query.page,
        pageSize: query.pageSize,
        filters: {
          search: query.search,
          createdAfter: query.createdAfter,
          createdBefore: query.createdBefore,
          createdBy: query.createdBy,
          locale: query.locale,
        },
      },
    );
    return paginatedPageGroupsSchema.parse({
      total: result.total,
      items: result.items.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
    });
  }

  @Patch('reorder')
  @HttpCode(204)
  async reorder(
    @Body(new ZodValidationPipe(reorderPageGroupsBodySchema))
    body: ReorderPageGroupsBody,
  ): Promise<void> {
    await reorderSiblingPageGroups(
      { pageGroupRepository: this.pageGroupRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        siteId: body.siteId,
        parentId: body.parentId,
        orderedPageGroupIds: body.orderedPageGroupIds,
      },
    );
  }

  @Post(':id/duplicate')
  async duplicate(@Param('id') id: string) {
    const result = await duplicatePageGroup(
      {
        pageGroupRepository: this.pageGroupRepository,
        pageTranslationRepository: this.pageTranslationRepository,
      },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        sourceGroupId: id,
        createdBy: this.tenantContext.getCurrentUserId(),
      },
    );
    return this.toGroupDto(result.group);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const group = await getPageGroupById(
      { pageGroupRepository: this.pageGroupRepository },
      { tenantId: this.tenantContext.getCurrentTenantId(), pageGroupId: id },
    );
    return this.toGroupDto(group);
  }

  @Patch(':id/content')
  async saveContent(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(savePageGroupContentBodySchema))
    body: SavePageGroupContentBody,
  ) {
    const group = await savePageGroupContent(
      { pageGroupRepository: this.pageGroupRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        pageGroupId: id,
        content: body.content,
        actorUserId: this.tenantContext.getCurrentUserId(),
      },
    );
    return this.toGroupDto(group);
  }

  @Patch(':id/rollback')
  async rollback(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rollbackPageGroupBodySchema))
    body: RollbackPageGroupBody,
  ) {
    const group = await rollbackPageGroupToVersion(
      {
        pageGroupRepository: this.pageGroupRepository,
        pageGroupVersionRepository: this.pageGroupVersionRepository,
      },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        pageGroupId: id,
        versionId: body.versionId,
        actorUserId: this.tenantContext.getCurrentUserId(),
      },
    );
    return this.toGroupDto(group);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    await deletePageGroup(
      { pageGroupRepository: this.pageGroupRepository },
      { tenantId: this.tenantContext.getCurrentTenantId(), pageGroupId: id },
    );
  }

  @Get(':id/versions')
  async listVersions(@Param('id') id: string) {
    const versions = await listPageGroupVersions(
      { pageGroupVersionRepository: this.pageGroupVersionRepository },
      { tenantId: this.tenantContext.getCurrentTenantId(), pageGroupId: id },
    );
    return versions.map((version) => this.toGroupVersionDto(version));
  }

  @Get(':id/translations')
  async listTranslations(@Param('id') id: string) {
    const translations = await listPageGroupTranslations(
      {
        pageGroupRepository: this.pageGroupRepository,
        pageTranslationRepository: this.pageTranslationRepository,
      },
      { tenantId: this.tenantContext.getCurrentTenantId(), pageGroupId: id },
    );
    return translations.map((translation) =>
      this.toTranslationDto(translation),
    );
  }

  @Post(':id/translations')
  async createTranslation(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createPageGroupTranslationBodySchema))
    body: CreatePageGroupTranslationBody,
  ) {
    const translation = await createPageGroupTranslation(
      {
        pageGroupRepository: this.pageGroupRepository,
        pageTranslationRepository: this.pageTranslationRepository,
      },
      {
        ...body,
        pageGroupId: id,
        tenantId: this.tenantContext.getCurrentTenantId(),
        createdBy: this.tenantContext.getCurrentUserId(),
      },
    );
    return this.toTranslationDto(translation);
  }

  @Patch('translations/:translationId/field-values')
  async saveFieldValues(
    @Param('translationId') translationId: string,
    @Body(new ZodValidationPipe(savePageTranslationFieldValuesBodySchema))
    body: SavePageTranslationFieldValuesBody,
  ) {
    const translation = await savePageTranslationFieldValues(
      { pageTranslationRepository: this.pageTranslationRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        pageTranslationId: translationId,
        fieldValues: body.fieldValues,
        parentGroupId: body.parentGroupId,
        actorUserId: this.tenantContext.getCurrentUserId(),
      },
    );
    return this.toTranslationDto(translation);
  }

  @Patch('translations/:translationId/diverged-content')
  async saveDivergedContent(
    @Param('translationId') translationId: string,
    @Body(new ZodValidationPipe(saveDivergedPageTranslationContentBodySchema))
    body: SaveDivergedPageTranslationContentBody,
  ) {
    const translation = await saveDivergedPageTranslationContent(
      { pageTranslationRepository: this.pageTranslationRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        pageTranslationId: translationId,
        content: body.content,
        parentGroupId: body.parentGroupId,
      },
    );
    return this.toTranslationDto(translation);
  }

  @Patch('translations/:translationId/seo')
  async updateSeo(
    @Param('translationId') translationId: string,
    @Body(new ZodValidationPipe(updatePageTranslationSeoMetaBodySchema))
    body: UpdatePageTranslationSeoMetaBody,
  ) {
    const translation = await updatePageTranslationSeoMeta(
      { pageTranslationRepository: this.pageTranslationRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        pageTranslationId: translationId,
        seoMeta: body.seoMeta,
        parentGroupId: body.parentGroupId,
      },
    );
    return this.toTranslationDto(translation);
  }

  // Only admin/publisher can publish, draft/save stays open to every
  // logged-in role.
  @Post('translations/:translationId/publish')
  @UseGuards(RolesGuard)
  @Roles('admin', 'publisher')
  async publish(@Param('translationId') translationId: string) {
    const translation = await publishPageTranslation(
      {
        pageGroupRepository: this.pageGroupRepository,
        pageTranslationRepository: this.pageTranslationRepository,
        searchPort: this.searchPort,
      },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        pageTranslationId: translationId,
      },
    );
    return this.toTranslationDto(translation);
  }

  @Post('translations/:translationId/diverge')
  async diverge(@Param('translationId') translationId: string) {
    const translation = await divergePageTranslation(
      {
        pageGroupRepository: this.pageGroupRepository,
        pageTranslationRepository: this.pageTranslationRepository,
      },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        pageTranslationId: translationId,
        actorUserId: this.tenantContext.getCurrentUserId(),
      },
    );
    return this.toTranslationDto(translation);
  }

  // Same gate as PagesController.createPreviewToken: every role that can
  // save a draft can also preview it, not just admin/publisher.
  @Post('translations/:translationId/preview-token')
  async createPreviewToken(@Param('translationId') translationId: string) {
    await getPageTranslationById(
      { pageTranslationRepository: this.pageTranslationRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        pageTranslationId: translationId,
      },
    );
    const { token, expiresAt } = await this.previewTokenPort.createToken(
      this.tenantContext.getCurrentTenantId(),
      'page',
      translationId,
      PREVIEW_TOKEN_TTL_MS,
    );
    return { token, expiresAt };
  }

  @Get('translations/:translationId/versions')
  async listTranslationVersions(@Param('translationId') translationId: string) {
    const versions = await listPageTranslationVersions(
      {
        pageTranslationVersionRepository: this.pageTranslationVersionRepository,
      },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        pageTranslationId: translationId,
      },
    );
    return versions.map((version) => this.toTranslationVersionDto(version));
  }

  /** Same whitelist discipline as PagesController.toDto (security review 2026-08-24) — never the raw entity. */
  private toGroupDto(group: PageGroup): PageGroupRecord {
    const props = group.toProps();
    return pageGroupRecordSchema.parse({
      id: props.id,
      tenantId: props.tenantId,
      siteId: props.siteId,
      parentId: props.parentId,
      order: props.order,
      content: props.content,
      createdBy: props.createdBy,
      createdAt: props.createdAt.toISOString(),
      updatedAt: props.updatedAt.toISOString(),
    });
  }

  private toTranslationDto(
    translation: PageTranslation,
  ): PageTranslationRecord {
    const props = translation.toProps();
    return pageTranslationRecordSchema.parse({
      id: props.id,
      tenantId: props.tenantId,
      siteId: props.siteId,
      pageGroupId: props.pageGroupId,
      locale: props.locale,
      slug: props.slug,
      seoMeta: props.seoMeta,
      fieldValues: props.fieldValues,
      status: props.status,
      publishedSnapshot: props.publishedSnapshot,
      isDiverged: props.isDiverged,
      divergedContent: props.divergedContent,
      createdBy: props.createdBy,
      createdAt: props.createdAt.toISOString(),
      updatedAt: props.updatedAt.toISOString(),
    });
  }

  private toGroupVersionDto(version: PageGroupVersion) {
    return pageGroupVersionRecordSchema.parse({
      ...version,
      createdAt: version.createdAt.toISOString(),
    });
  }

  private toTranslationVersionDto(version: PageTranslationVersion) {
    return pageTranslationVersionRecordSchema.parse({
      ...version,
      createdAt: version.createdAt.toISOString(),
    });
  }
}
