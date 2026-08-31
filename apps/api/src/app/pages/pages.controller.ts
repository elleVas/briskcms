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
  createPageTranslation,
  deletePage,
  duplicatePage,
  getPageById,
  getPageBySlug,
  listPages,
  listPageTranslations,
  listPageVersions,
  markTranslationSynced,
  publishPage,
  reorderSiblingPages,
  rollbackToVersion,
  saveDraft,
  setPageParent,
  updateSeoMeta,
} from '@brisk/application';
import type { Page, PageVersion } from '@brisk/domain-core';
import type {
  PageRepositoryPort,
  PageVersionRepositoryPort,
  PreviewTokenPort,
  SearchPort,
  TenantContextPort,
} from '@brisk/ports';
import {
  pageRecordSchema,
  pageVersionRecordSchema,
  paginatedPagesSchema,
  type PageRecord,
} from '@brisk/shared-types';
import { PREVIEW_TOKEN_TTL_MS } from '../preview-token-ttl.constant';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { ZodValidationPipe } from '../zod-validation.pipe';
import { TENANT_CONTEXT } from '../auth/auth.tokens';
import {
  PAGE_REPOSITORY,
  PAGE_VERSION_REPOSITORY,
  PREVIEW_TOKEN_PORT,
  SEARCH_REPOSITORY,
} from './pages.tokens';
import {
  type CreatePageBody,
  createPageBodySchema,
  type CreateTranslationBody,
  createTranslationBodySchema,
  type MarkTranslationSyncedBody,
  markTranslationSyncedBodySchema,
  type DuplicatePageBody,
  duplicatePageBodySchema,
  type ListPagesQuery,
  listPagesQuerySchema,
  type ReorderPagesBody,
  reorderPagesBodySchema,
  type RollbackBody,
  rollbackBodySchema,
  type SaveDraftBody,
  saveDraftBodySchema,
  type SetPageParentBody,
  setPageParentBodySchema,
  type UpdateSeoMetaBody,
  updateSeoMetaBodySchema,
} from './pages.schemas';

@Controller('pages')
@UseGuards(SessionAuthGuard)
export class PagesController {
  constructor(
    @Inject(PAGE_REPOSITORY)
    private readonly pageRepository: PageRepositoryPort,
    @Inject(PAGE_VERSION_REPOSITORY)
    private readonly pageVersionRepository: PageVersionRepositoryPort,
    @Inject(SEARCH_REPOSITORY)
    private readonly searchPort: SearchPort,
    @Inject(TENANT_CONTEXT) private readonly tenantContext: TenantContextPort,
    @Inject(PREVIEW_TOKEN_PORT)
    private readonly previewTokenPort: PreviewTokenPort,
  ) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createPageBodySchema)) body: CreatePageBody,
  ) {
    const page = await createPage(
      { pageRepository: this.pageRepository },
      {
        ...body,
        createdBy: this.tenantContext.getCurrentUserId(),
        tenantId: this.tenantContext.getCurrentTenantId(),
      },
    );
    return this.toDto(page);
  }

  @Patch('reorder')
  @HttpCode(204)
  async reorder(
    @Body(new ZodValidationPipe(reorderPagesBodySchema))
    body: ReorderPagesBody,
  ): Promise<void> {
    await reorderSiblingPages(
      { pageRepository: this.pageRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        siteId: body.siteId,
        locale: body.locale,
        parentId: body.parentId,
        orderedPageIds: body.orderedPageIds,
      },
    );
  }

  @Patch(':id/parent')
  async setParent(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setPageParentBodySchema))
    body: SetPageParentBody,
  ) {
    const page = await setPageParent(
      { pageRepository: this.pageRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        pageId: id,
        parentId: body.parentId,
      },
    );
    return this.toDto(page);
  }

  @Get()
  async list(
    @Query(new ZodValidationPipe(listPagesQuerySchema)) query: ListPagesQuery,
  ) {
    const result = await listPages(
      { pageRepository: this.pageRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        siteId: query.siteId,
        page: query.page,
        pageSize: query.pageSize,
      },
    );
    return paginatedPagesSchema.parse({
      total: result.total,
      items: result.items.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
    });
  }

  @Get('by-slug')
  async findBySlug(
    @Query('siteId') siteId: string,
    @Query('locale') locale: string,
    @Query('slug') slug: string,
    @Query('parentId') parentId?: string,
  ) {
    const page = await getPageBySlug(
      { pageRepository: this.pageRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        siteId,
        locale,
        parentId: parentId ?? null,
        slug,
      },
    );
    return this.toDto(page);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const page = await getPageById(
      { pageRepository: this.pageRepository },
      { tenantId: this.tenantContext.getCurrentTenantId(), pageId: id },
    );
    return this.toDto(page);
  }

  // Ogni ruolo che può salvare una bozza deve poter anche previewarla —
  // stesso gate di saveDraft sotto, non ristretto come publish.
  @Post(':id/preview-token')
  async createPreviewToken(@Param('id') id: string) {
    await getPageById(
      { pageRepository: this.pageRepository },
      { tenantId: this.tenantContext.getCurrentTenantId(), pageId: id },
    );
    const { token, expiresAt } = await this.previewTokenPort.createToken(
      this.tenantContext.getCurrentTenantId(),
      'page',
      id,
      PREVIEW_TOKEN_TTL_MS,
    );
    return { token, expiresAt };
  }

  @Patch(':id/draft')
  async saveDraft(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(saveDraftBodySchema)) body: SaveDraftBody,
  ) {
    const page = await saveDraft(
      { pageRepository: this.pageRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        pageId: id,
        content: body.content,
        actorUserId: null,
      },
    );
    return this.toDto(page);
  }

  @Patch(':id/seo')
  async updateSeo(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSeoMetaBodySchema))
    body: UpdateSeoMetaBody,
  ) {
    const page = await updateSeoMeta(
      { pageRepository: this.pageRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        pageId: id,
        seoMeta: body.seoMeta,
      },
    );
    return this.toDto(page);
  }

  // Fase 5c: only admin/publisher can publish — draft/save stays open to
  // every logged-in role (editor included), only this one action is
  // gated.
  @Post(':id/publish')
  @UseGuards(RolesGuard)
  @Roles('admin', 'publisher')
  async publish(@Param('id') id: string) {
    const page = await publishPage(
      { pageRepository: this.pageRepository, searchPort: this.searchPort },
      { tenantId: this.tenantContext.getCurrentTenantId(), pageId: id },
    );
    return this.toDto(page);
  }

  @Get(':id/versions')
  async listVersions(@Param('id') id: string) {
    const versions = await listPageVersions(
      { pageVersionRepository: this.pageVersionRepository },
      { tenantId: this.tenantContext.getCurrentTenantId(), pageId: id },
    );
    return versions.map((version) => this.toVersionDto(version));
  }

  @Get(':id/translations')
  async listTranslations(@Param('id') id: string) {
    const translations = await listPageTranslations(
      { pageRepository: this.pageRepository },
      { tenantId: this.tenantContext.getCurrentTenantId(), pageId: id },
    );
    return translations.map((page) => this.toDto(page));
  }

  @Post(':id/translations')
  async createTranslation(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createTranslationBodySchema))
    body: CreateTranslationBody,
  ) {
    const translation = await createPageTranslation(
      { pageRepository: this.pageRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        sourcePageId: id,
        locale: body.locale,
        slug: body.slug,
        createdBy: null,
      },
    );
    return this.toDto(translation);
  }

  @Patch(':id/mark-translation-synced')
  async markTranslationSynced(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(markTranslationSyncedBodySchema))
    body: MarkTranslationSyncedBody,
  ) {
    const page = await markTranslationSynced(
      { pageRepository: this.pageRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        pageId: id,
        structureSignature: body.structureSignature,
      },
    );
    return this.toDto(page);
  }

  @Post(':id/duplicate')
  async duplicate(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(duplicatePageBodySchema))
    body: DuplicatePageBody,
  ) {
    const duplicate = await duplicatePage(
      { pageRepository: this.pageRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        sourcePageId: id,
        slug: body.slug,
        title: body.title,
        description: body.description,
        createdBy: null,
      },
    );
    return this.toDto(duplicate);
  }

  @Post(':id/rollback')
  async rollback(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rollbackBodySchema)) body: RollbackBody,
  ) {
    const page = await rollbackToVersion(
      {
        pageRepository: this.pageRepository,
        pageVersionRepository: this.pageVersionRepository,
      },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        pageId: id,
        versionId: body.versionId,
        actorUserId: null,
      },
    );
    return this.toDto(page);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    await deletePage(
      { pageRepository: this.pageRepository },
      { tenantId: this.tenantContext.getCurrentTenantId(), pageId: id },
    );
  }

  /**
   * Security review 2026-08-24, backend seconda passata: a differenza di
   * UsersController/MediaController (whitelist esplicita già presente),
   * questo controller restituiva page.toProps() grezzo su ogni endpoint —
   * nessun campo sensibile su Page oggi, ma senza whitelist un futuro
   * campo lo esporrebbe automaticamente, senza che nessuno se ne accorga
   * qui.
   */
  private toDto(page: Page): PageRecord {
    const props = page.toProps();
    // Validated, not just cast: pageRecordSchema is the same schema
    // apps/editor-app's pages-api-client.ts parses the response against.
    return pageRecordSchema.parse({
      id: props.id,
      tenantId: props.tenantId,
      siteId: props.siteId,
      groupId: props.groupId,
      locale: props.locale,
      slug: props.slug,
      parentId: props.parentId,
      status: props.status,
      content: props.content,
      publishedContent: props.publishedContent,
      seoMeta: props.seoMeta,
      syncedStructureSignature: props.syncedStructureSignature,
      createdAt: props.createdAt.toISOString(),
      updatedAt: props.updatedAt.toISOString(),
    });
  }

  private toVersionDto(version: PageVersion) {
    return pageVersionRecordSchema.parse({
      ...version,
      createdAt: version.createdAt.toISOString(),
    });
  }
}
