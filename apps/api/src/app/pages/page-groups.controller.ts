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
  createPage,
  createPageGroup,
  createPageGroupTranslation,
  deletePageGroup,
  divergePageTranslation,
  duplicatePageGroup,
  getPageGroupById,
  getPageTranslationById,
  listPageGroups,
  movePageGroupToCollection,
  movePageGroupToParent,
  listPageGroupTerms,
  listPageGroupTranslations,
  listPageGroupVersions,
  listPageTranslationVersions,
  publishPageTranslation,
  reorderSiblingPageGroups,
  relinkPageTranslation,
  rollbackPageGroupToVersion,
  rollbackPageTranslationToVersion,
  saveDivergedPageTranslationContent,
  savePageGroupAsTemplate,
  savePageGroupContent,
  savePageTranslationFieldValues,
  setPageGroupTerms,
  renamePageTranslation,
  updatePageTranslationSeoMeta,
} from '@brisk/application';
import type {
  PageGroup,
  PageGroupVersion,
  PageTranslation,
  PageTranslationVersion,
} from '@brisk/domain-core';
import type {
  CollectionRepositoryPort,
  PageGroupRepositoryPort,
  PageGroupVersionRepositoryPort,
  PageTranslationRepositoryPort,
  PageTranslationVersionRepositoryPort,
  PreviewTokenPort,
  ReusableSectionRepositoryPort,
  ReusableSectionVersionRepositoryPort,
  SearchPort,
  SiteRepositoryPort,
  TaxonomyRepositoryPort,
  TenantContextPort,
} from '@brisk/ports';
import {
  pageGroupRecordSchema,
  pageGroupTermsSchema,
  pageGroupVersionRecordSchema,
  pageTranslationRecordSchema,
  pageTranslationVersionRecordSchema,
  paginatedPageGroupsSchema,
  type FieldValueOverlay,
  type PageGroupRecord,
  type PageGroupTerms,
  type ReusableSectionRecord,
  type PageTranslationRecord,
} from '@brisk/shared-types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { ReusableSectionRecords } from '../reusable-sections/reusable-section-records';
import { ZodValidationPipe } from '../zod-validation.pipe';
import {
  pageGroupTermsBodySchema,
  type PageGroupTermsBody,
} from '../taxonomies/taxonomies.schemas';
import { TENANT_CONTEXT } from '../auth/auth.tokens';
import { PREVIEW_TOKEN_TTL_MS } from '../preview-token-ttl.constant';
import {
  PAGE_GROUP_REPOSITORY,
  PAGE_GROUP_VERSION_REPOSITORY,
  PAGE_TRANSLATION_REPOSITORY,
  PAGE_TRANSLATION_VERSION_REPOSITORY,
} from './page-groups.tokens';
import {
  PREVIEW_TOKEN_PORT,
  REUSABLE_SECTION_REPOSITORY,
  REUSABLE_SECTION_VERSION_REPOSITORY,
  SEARCH_REPOSITORY,
  SITE_REPOSITORY,
  TAXONOMY_REPOSITORY,
  COLLECTION_REPOSITORY,
} from './pages.tokens';
import {
  type CreatePageGroupBody,
  createPageGroupBodySchema,
  type SaveAsTemplateBody,
  saveAsTemplateBodySchema,
  type CreatePageGroupTranslationBody,
  createPageGroupTranslationBodySchema,
  type ListPageGroupsQuery,
  type MoveToCollectionBody,
  type MoveToParentBody,
  listPageGroupsQuerySchema,
  moveToCollectionBodySchema,
  moveToParentBodySchema,
  type ReorderPageGroupsBody,
  reorderPageGroupsBodySchema,
  type RelinkPageTranslationBody,
  relinkPageTranslationBodySchema,
  type RollbackToVersionBody,
  rollbackToVersionBodySchema,
  type SaveDivergedPageTranslationContentBody,
  saveDivergedPageTranslationContentBodySchema,
  type SavePageGroupContentBody,
  savePageGroupContentBodySchema,
  type SavePageTranslationFieldValuesBody,
  savePageTranslationFieldValuesBodySchema,
  type RenamePageTranslationBody,
  type UpdatePageTranslationSeoMetaBody,
  renamePageTranslationBodySchema,
  updatePageTranslationSeoMetaBodySchema,
} from './page-groups.schemas';
import { sanitizeFieldValueOverlay } from '../rich-text/sanitize-page-content';

/**
 * Field-level i18n (docs/adr/0034): shared structure (`PageGroup`) plus
 * per-locale text (`PageTranslation`). The old `PagesController` and its
 * duplicated-page tables are gone, so this is the only pages controller.
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
    @Inject(REUSABLE_SECTION_REPOSITORY)
    private readonly reusableSectionRepository: ReusableSectionRepositoryPort,
    @Inject(TAXONOMY_REPOSITORY)
    private readonly taxonomyRepository: TaxonomyRepositoryPort,
    @Inject(SITE_REPOSITORY)
    private readonly siteRepository: SiteRepositoryPort,
    @Inject(COLLECTION_REPOSITORY)
    private readonly collectionRepository: CollectionRepositoryPort,
    @Inject(REUSABLE_SECTION_VERSION_REPOSITORY)
    private readonly reusableSectionVersionRepository: ReusableSectionVersionRepositoryPort,
    private readonly sectionRecords: ReusableSectionRecords,
  ) {}

  /** What the taxonomy use cases need — the same three everywhere they are called. */
  private get taxonomyDeps() {
    return {
      taxonomyRepository: this.taxonomyRepository,
      pageTranslationRepository: this.pageTranslationRepository,
      siteRepository: this.siteRepository,
    };
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(createPageGroupBodySchema))
    body: CreatePageGroupBody,
  ) {
    const { translation, templateId, ...rest } = body;
    const input = {
      ...rest,
      createdBy: this.tenantContext.getCurrentUserId(),
      tenantId: this.tenantContext.getCurrentTenantId(),
    };
    // With its first language, the page is written in one transaction —
    // what the editor always sends (docs/adr/0072). Without it, the group
    // alone, as the API has always allowed.
    const group = translation
      ? (
          await createPage(
            {
              pageGroupRepository: this.pageGroupRepository,
              pageTranslationRepository: this.pageTranslationRepository,
              taxonomyRepository: this.taxonomyRepository,
              reusableSectionRepository: this.reusableSectionRepository,
            },
            { ...input, ...translation, templateId },
          )
        ).group
      : await createPageGroup(
          { pageGroupRepository: this.pageGroupRepository },
          input,
        );
    return this.toGroupDto(group);
  }

  /**
   * "Save as template": a published template holding what this page shows
   * in the site's default language (docs/adr/0072). Answered with the
   * template in the same shape `GET /reusable-sections/:id` returns, since
   * that is the list the editor refreshes afterwards.
   */
  @Post(':id/save-as-template')
  async saveAsTemplate(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(saveAsTemplateBodySchema))
    body: SaveAsTemplateBody,
  ): Promise<ReusableSectionRecord> {
    const template = await savePageGroupAsTemplate(
      {
        pageGroupRepository: this.pageGroupRepository,
        pageTranslationRepository: this.pageTranslationRepository,
        siteRepository: this.siteRepository,
        reusableSectionRepository: this.reusableSectionRepository,
        reusableSectionVersionRepository: this.reusableSectionVersionRepository,
      },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        pageGroupId: id,
        name: body.name,
        actorUserId: this.tenantContext.getCurrentUserId(),
      },
    );
    return this.sectionRecords.toRecord(template);
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
          excludeSubtreeOf: query.excludeSubtreeOf,
          ...(query.collection === undefined
            ? {}
            : {
                collectionId:
                  query.collection === 'none' ? null : query.collection,
              }),
        },
      },
    );
    return paginatedPageGroupsSchema.parse({
      total: result.total,
      items: result.items.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        lastEditedAt: item.lastEditedAt.toISOString(),
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
        actorUserId: this.tenantContext.getCurrentUserId(),
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
    @Body(new ZodValidationPipe(rollbackToVersionBodySchema))
    body: RollbackToVersionBody,
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
        taxonomyRepository: this.taxonomyRepository,
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

  /**
   * What this page is filed under, across every dimension at once
   * (docs/adr/0064). On the GROUP and not the translation, exactly as
   * the hierarchy is: the Italian and the English version of an article
   * are the same article.
   */
  @Get(':id/terms')
  async listTerms(@Param('id') id: string): Promise<PageGroupTerms> {
    await getPageGroupById(
      { pageGroupRepository: this.pageGroupRepository },
      { tenantId: this.tenantContext.getCurrentTenantId(), pageGroupId: id },
    );
    return pageGroupTermsSchema.parse({
      termIds: await listPageGroupTerms(
        this.taxonomyDeps,
        this.tenantContext.getCurrentTenantId(),
        id,
      ),
    });
  }

  /** The whole set, not a diff — the editor knows which boxes are ticked, not which changed. */
  @Patch(':id/terms')
  async setTerms(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(pageGroupTermsBodySchema))
    body: PageGroupTermsBody,
  ): Promise<PageGroupTerms> {
    await getPageGroupById(
      { pageGroupRepository: this.pageGroupRepository },
      { tenantId: this.tenantContext.getCurrentTenantId(), pageGroupId: id },
    );
    return pageGroupTermsSchema.parse({
      termIds: await setPageGroupTerms(this.taxonomyDeps, {
        tenantId: this.tenantContext.getCurrentTenantId(),
        pageGroupId: id,
        termIds: body.termIds,
      }),
    });
  }

  /** Which section of the editor lists this page — not where it lives on the site. */
  @Patch(':id/collection')
  async moveToCollection(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(moveToCollectionBodySchema))
    body: MoveToCollectionBody,
  ) {
    const group = await movePageGroupToCollection(
      {
        pageGroupRepository: this.pageGroupRepository,
        collectionRepository: this.collectionRepository,
      },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        pageGroupId: id,
        collectionId: body.collectionId,
        actorUserId: this.tenantContext.getCurrentUserId(),
      },
    );
    return this.toGroupDto(group);
  }

  /*
   * Where the page hangs in the site's tree — its address, and the
   * address of everything under it. A different thing from
   * `:id/collection`, which only decides which screen lists it.
   */
  @Patch(':id/parent')
  async moveToParent(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(moveToParentBodySchema))
    body: MoveToParentBody,
  ) {
    const group = await movePageGroupToParent(
      {
        pageGroupRepository: this.pageGroupRepository,
        pageTranslationRepository: this.pageTranslationRepository,
        taxonomyRepository: this.taxonomyRepository,
      },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        pageGroupId: id,
        parentId: body.parentId,
        actorUserId: this.tenantContext.getCurrentUserId(),
      },
    );
    return this.toGroupDto(group);
  }

  @Patch('translations/:translationId/field-values')
  async saveFieldValues(
    @Param('translationId') translationId: string,
    @Body(new ZodValidationPipe(savePageTranslationFieldValuesBodySchema))
    body: SavePageTranslationFieldValuesBody,
  ) {
    const tenantId = this.tenantContext.getCurrentTenantId();
    const translation = await savePageTranslationFieldValues(
      { pageTranslationRepository: this.pageTranslationRepository },
      {
        tenantId,
        pageTranslationId: translationId,
        fieldValues: await this.sanitizedOverlay(
          tenantId,
          translationId,
          body.fieldValues,
        ),
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
        actorUserId: this.tenantContext.getCurrentUserId(),
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
        actorUserId: this.tenantContext.getCurrentUserId(),
      },
    );
    return this.toTranslationDto(translation);
  }

  /**
   * Moves this language's page to a new address.
   *
   * Not part of the SEO patch above even though both edit one
   * translation: changing a meta description is a correction, changing an
   * address is a move — it retires a URL, leaves a 301 behind it, and can
   * be refused because a sibling already answers there. Folding it into
   * `seo` would have made all of that invisible at the call site.
   */
  @Patch('translations/:translationId/slug')
  async rename(
    @Param('translationId') translationId: string,
    @Body(new ZodValidationPipe(renamePageTranslationBodySchema))
    body: RenamePageTranslationBody,
  ) {
    const translation = await renamePageTranslation(
      { pageTranslationRepository: this.pageTranslationRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        pageTranslationId: translationId,
        slug: body.slug,
        parentGroupId: body.parentGroupId,
        actorUserId: this.tenantContext.getCurrentUserId(),
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
        reusableSectionRepository: this.reusableSectionRepository,
        searchPort: this.searchPort,
      },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        pageTranslationId: translationId,
        actorUserId: this.tenantContext.getCurrentUserId(),
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

  /**
   * Brings an unlinked language back onto the shared structure, with the
   * text the editor carried over from its fork (docs/adr/0075).
   */
  @Post('translations/:translationId/relink')
  async relink(
    @Param('translationId') translationId: string,
    @Body(new ZodValidationPipe(relinkPageTranslationBodySchema))
    body: RelinkPageTranslationBody,
  ) {
    const tenantId = this.tenantContext.getCurrentTenantId();
    const translation = await relinkPageTranslation(
      {
        pageGroupRepository: this.pageGroupRepository,
        pageTranslationRepository: this.pageTranslationRepository,
      },
      {
        tenantId,
        pageTranslationId: translationId,
        fieldValues: await this.sanitizedOverlay(
          tenantId,
          translationId,
          body.fieldValues,
        ),
        actorUserId: this.tenantContext.getCurrentUserId(),
      },
    );
    return this.toTranslationDto(translation);
  }

  @Patch('translations/:translationId/rollback')
  async rollbackTranslation(
    @Param('translationId') translationId: string,
    @Body(new ZodValidationPipe(rollbackToVersionBodySchema))
    body: RollbackToVersionBody,
  ) {
    const translation = await rollbackPageTranslationToVersion(
      {
        pageGroupRepository: this.pageGroupRepository,
        pageTranslationRepository: this.pageTranslationRepository,
        pageTranslationVersionRepository: this.pageTranslationVersionRepository,
      },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        pageTranslationId: translationId,
        versionId: body.versionId,
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

  /**
   * A language's overlay made safe to render. The only content entrance a
   * schema cannot guard on its own (see sanitized-page-content.schema.ts):
   * the overlay records a block ID, and only the group's own tree says
   * what TYPE that block is — which is what decides whether a field is
   * rich text at all. Sanitising every value instead would be
   * destructive, because `Code.code` is deliberately `translatable` and a
   * snippet would lose everything after its first `<`.
   *
   * The group is found through the translation, never through a
   * `parentGroupId` in the body — that one is the group's parent in the
   * page HIERARCHY, and sanitising against it would mean sanitising
   * against another page's tree. An unknown translation is returned as
   * is: the use case that follows refuses it with the right error.
   */
  private async sanitizedOverlay(
    tenantId: string,
    translationId: string,
    fieldValues: FieldValueOverlay,
  ): Promise<FieldValueOverlay> {
    const translation = await this.pageTranslationRepository.findById(
      tenantId,
      translationId,
    );
    const group = translation
      ? await this.pageGroupRepository.findById(
          tenantId,
          translation.pageGroupId,
        )
      : null;
    return group
      ? sanitizeFieldValueOverlay(fieldValues, group.content)
      : fieldValues;
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
      collectionId: props.collectionId,
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
