import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Patch,
  Query,
} from '@nestjs/common';
import {
  createPage,
  listPageVersions,
  publishPage,
  rollbackToVersion,
  saveDraft,
} from '@brisk/application';
import {
  PageNotFoundError,
  PageVersionNotFoundError,
} from '@brisk/domain-core';
import type {
  PageRepositoryPort,
  PageVersionRepositoryPort,
  TenantContextPort,
} from '@brisk/ports';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import {
  PAGE_REPOSITORY,
  PAGE_VERSION_REPOSITORY,
  TENANT_CONTEXT,
} from './pages.tokens.js';
import {
  type CreatePageBody,
  createPageBodySchema,
  type RollbackBody,
  rollbackBodySchema,
  type SaveDraftBody,
  saveDraftBodySchema,
} from './pages.schemas.js';

@Controller('pages')
export class PagesController {
  constructor(
    @Inject(PAGE_REPOSITORY)
    private readonly pageRepository: PageRepositoryPort,
    @Inject(PAGE_VERSION_REPOSITORY)
    private readonly pageVersionRepository: PageVersionRepositoryPort,
    @Inject(TENANT_CONTEXT) private readonly tenantContext: TenantContextPort,
  ) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createPageBodySchema)) body: CreatePageBody,
  ) {
    const page = await createPage(
      {
        pageRepository: this.pageRepository,
        pageVersionRepository: this.pageVersionRepository,
      },
      {
        ...body,
        createdBy: null,
        tenantId: this.tenantContext.getCurrentTenantId(),
      },
    );
    return page.toProps();
  }

  @Get('by-slug')
  async findBySlug(
    @Query('siteId') siteId: string,
    @Query('locale') locale: string,
    @Query('slug') slug: string,
  ) {
    const page = await this.pageRepository.findBySlug(
      this.tenantContext.getCurrentTenantId(),
      siteId,
      locale,
      slug,
    );
    if (!page) {
      throw new NotFoundException(
        `Page not found: ${siteId}/${locale}/${slug}`,
      );
    }
    return page.toProps();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const page = await this.pageRepository.findById(
      this.tenantContext.getCurrentTenantId(),
      id,
    );
    if (!page) {
      throw new NotFoundException(`Page not found: ${id}`);
    }
    return page.toProps();
  }

  @Patch(':id/draft')
  async saveDraft(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(saveDraftBodySchema)) body: SaveDraftBody,
  ) {
    return this.handleNotFound(async () => {
      const page = await saveDraft(
        {
          pageRepository: this.pageRepository,
          pageVersionRepository: this.pageVersionRepository,
        },
        {
          tenantId: this.tenantContext.getCurrentTenantId(),
          pageId: id,
          content: body.content,
          actorUserId: null,
        },
      );
      return page.toProps();
    });
  }

  @Post(':id/publish')
  async publish(@Param('id') id: string) {
    return this.handleNotFound(async () => {
      const page = await publishPage(
        { pageRepository: this.pageRepository },
        { tenantId: this.tenantContext.getCurrentTenantId(), pageId: id },
      );
      return page.toProps();
    });
  }

  @Get(':id/versions')
  async listVersions(@Param('id') id: string) {
    const versions = await listPageVersions(
      { pageVersionRepository: this.pageVersionRepository },
      { tenantId: this.tenantContext.getCurrentTenantId(), pageId: id },
    );
    return versions;
  }

  @Post(':id/rollback')
  async rollback(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rollbackBodySchema)) body: RollbackBody,
  ) {
    return this.handleNotFound(async () => {
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
      return page.toProps();
    });
  }

  private async handleNotFound<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (
        error instanceof PageNotFoundError ||
        error instanceof PageVersionNotFoundError
      ) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
