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
  createCollection,
  deleteCollection,
  listCollections,
  updateCollection,
} from '@brisk/application';
import type { Collection } from '@brisk/domain-core';
import type { CollectionRepositoryPort, TenantContextPort } from '@brisk/ports';
import { collectionRecordSchema } from '@brisk/shared-types';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { TENANT_CONTEXT } from '../auth/auth.tokens';
import { ZodValidationPipe } from '../zod-validation.pipe';
import {
  createCollectionBodySchema,
  listCollectionsQuerySchema,
  updateCollectionBodySchema,
  type CreateCollectionBody,
  type ListCollectionsQuery,
  type UpdateCollectionBody,
} from './collections.schemas';
import { COLLECTION_REPOSITORY } from './collections.tokens';

/**
 * The editor's own sections — News, Events, Case studies.
 *
 * A collection holds no content: the pages it lists are read through
 * `GET /page-groups?collection=<id>`, which is the same list the Pages
 * screen asks for with a different answer to the same question.
 */
@Controller('collections')
@UseGuards(SessionAuthGuard)
export class CollectionsController {
  constructor(
    @Inject(COLLECTION_REPOSITORY)
    private readonly collectionRepository: CollectionRepositoryPort,
    @Inject(TENANT_CONTEXT) private readonly tenantContext: TenantContextPort,
  ) {}

  private get deps() {
    return { collectionRepository: this.collectionRepository };
  }

  private get tenantId(): string {
    return this.tenantContext.getCurrentTenantId();
  }

  @Get()
  async list(
    @Query(new ZodValidationPipe(listCollectionsQuerySchema))
    query: ListCollectionsQuery,
  ) {
    const collections = await listCollections(
      this.deps,
      this.tenantId,
      query.siteId,
    );
    return collections.map((collection) => this.toDto(collection));
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(createCollectionBodySchema))
    body: CreateCollectionBody,
  ) {
    const collection = await createCollection(this.deps, {
      tenantId: this.tenantId,
      siteId: body.siteId,
      name: body.name,
      icon: body.icon,
    });
    return this.toDto(collection);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCollectionBodySchema))
    body: UpdateCollectionBody,
  ) {
    const collection = await updateCollection(this.deps, {
      tenantId: this.tenantId,
      collectionId: id,
      name: body.name,
      icon: body.icon,
    });
    return this.toDto(collection);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await deleteCollection(this.deps, this.tenantId, id);
  }

  /** Whitelisted field by field, never the raw entity — the same discipline as every other controller here. */
  private toDto(collection: Collection) {
    const props = collection.toProps();
    return collectionRecordSchema.parse({
      id: props.id,
      tenantId: props.tenantId,
      siteId: props.siteId,
      name: props.name,
      icon: props.icon,
      order: props.order,
      createdAt: props.createdAt.toISOString(),
      updatedAt: props.updatedAt.toISOString(),
    });
  }
}
