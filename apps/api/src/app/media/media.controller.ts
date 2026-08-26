import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { deleteMedia, listMedia, uploadMedia } from '@brisk/application';
import { type Media } from '@brisk/domain-core';
import type {
  MediaRepositoryPort,
  MediaStoragePort,
  TenantContextPort,
} from '@brisk/ports';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import {
  type ListMediaQuery,
  listMediaQuerySchema,
  type UploadMediaBody,
  uploadMediaBodySchema,
} from './media.schemas.js';
import {
  MEDIA_REPOSITORY,
  MEDIA_STORAGE,
  TENANT_CONTEXT,
} from './media.tokens.js';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB — a generous photo, not a video/archive

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
  ) {
    const result = await listMedia(
      { mediaRepository: this.mediaRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        siteId: query.siteId,
        page: query.page,
        pageSize: query.pageSize,
      },
    );
    return {
      items: result.items.map((item) => this.toDto(item)),
      total: result.total,
    };
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
  ) {
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
  async delete(@Param('id') id: string): Promise<void> {
    await deleteMedia(
      {
        mediaRepository: this.mediaRepository,
        mediaStorage: this.mediaStorage,
      },
      { tenantId: this.tenantContext.getCurrentTenantId(), mediaId: id },
    );
  }

  private toDto(media: Media) {
    return {
      ...media.toProps(),
      url: this.mediaStorage.getUrl(media.storageKey),
    };
  }
}
