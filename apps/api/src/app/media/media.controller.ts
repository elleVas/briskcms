import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import {
  countMediaByKind,
  deleteMedia,
  listMedia,
  uploadMedia,
} from '@brisk/application';
import { type Media } from '@brisk/domain-core';
import {
  type MediaKindCounts,
  type MediaRecord,
  type PaginatedMedia,
  mediaKindCountsSchema,
  mediaRecordSchema,
  paginatedMediaSchema,
} from '@brisk/shared-types';
import type {
  MediaRepositoryPort,
  MediaStoragePort,
  TenantContextPort,
} from '@brisk/ports';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { ZodValidationPipe } from '../zod-validation.pipe';
import {
  type CountMediaByKindQuery,
  countMediaByKindQuerySchema,
  type ListMediaQuery,
  listMediaQuerySchema,
  type UploadMediaBody,
  uploadMediaBodySchema,
} from './media.schemas';
import { TENANT_CONTEXT } from '../auth/auth.tokens';
import { MEDIA_REPOSITORY, MEDIA_STORAGE } from './media.tokens';
import { UuidParam } from '../uuid-param.decorator';

// The ceiling multer enforces before anything has been read — it cannot
// know what the file is yet, so it is the LARGEST any kind may be
// (ADR-0054). The real per-kind limits live in uploadMedia, which sniffs
// first: an oversized photo is refused there with the number it exceeded,
// rather than here with a generic one.
const MAX_UPLOAD_BYTES = 64 * 1024 * 1024;

@Controller('media')
@UseGuards(SessionAuthGuard)
export class MediaController {
  constructor(
    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: MediaRepositoryPort,
    @Inject(MEDIA_STORAGE) private readonly mediaStorage: MediaStoragePort,
    @Inject(TENANT_CONTEXT) private readonly tenantContext: TenantContextPort,
  ) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(listMediaQuerySchema)) query: ListMediaQuery,
  ): Promise<PaginatedMedia> {
    const result = await listMedia(
      { mediaRepository: this.mediaRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        siteId: query.siteId,
        page: query.page,
        pageSize: query.pageSize,
        filter: { search: query.search, kind: query.kind },
      },
    );
    return paginatedMediaSchema.parse({
      items: result.items.map((item) => this.toDto(item)),
      total: result.total,
    });
  }

  /**
   * What the library's folders show before one is opened. Registered as a
   * literal segment, so it is never mistaken for a media id.
   */
  @Get('kinds')
  async countByKind(
    @Query(new ZodValidationPipe(countMediaByKindQuerySchema))
    query: CountMediaByKindQuery,
  ): Promise<MediaKindCounts> {
    return mediaKindCountsSchema.parse(
      await countMediaByKind(
        { mediaRepository: this.mediaRepository },
        {
          tenantId: this.tenantContext.getCurrentTenantId(),
          siteId: query.siteId,
        },
      ),
    );
  }

  @Post()
  @UseGuards(ThrottlerGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body(new ZodValidationPipe(uploadMediaBodySchema)) body: UploadMediaBody,
  ): Promise<MediaRecord> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const media = await uploadMedia(
      {
        mediaRepository: this.mediaRepository,
        mediaStorage: this.mediaStorage,
      },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        siteId: body.siteId,
        filename: file.originalname,
        mimeType: file.mimetype,
        data: file.buffer,
      },
    );
    return this.toDto(media);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@UuidParam('id') id: string): Promise<void> {
    await deleteMedia(
      {
        mediaRepository: this.mediaRepository,
        mediaStorage: this.mediaStorage,
      },
      { tenantId: this.tenantContext.getCurrentTenantId(), mediaId: id },
    );
  }

  /**
   * Whitelisted field by field, never the entity spread: a spread ships
   * whatever field `Media` gains next without anybody deciding it should
   * leave the server.
   */
  private toDto(media: Media): MediaRecord {
    const props = media.toProps();
    return mediaRecordSchema.parse({
      id: props.id,
      tenantId: props.tenantId,
      siteId: props.siteId,
      filename: props.filename,
      storageKey: props.storageKey,
      storageProvider: props.storageProvider,
      mimeType: props.mimeType,
      size: props.size,
      width: props.width,
      height: props.height,
      createdAt: props.createdAt.toISOString(),
      url: this.mediaStorage.getUrl(props.storageKey),
    });
  }
}
