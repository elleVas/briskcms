import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import {
  changeAccountAvatar,
  getAccountProfile,
  MAX_UPLOAD_BYTES_BY_KIND,
  removeAccountAvatar,
  updateAccountProfile,
} from '@brisk/application';
import type {
  MediaStoragePort,
  TenantContextPort,
  UserRepositoryPort,
} from '@brisk/ports';
import { TENANT_CONTEXT, USER_REPOSITORY } from '../auth/auth.tokens';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { ZodValidationPipe } from '../zod-validation.pipe';
import {
  type UpdateAccountProfileBody,
  updateAccountProfileBodySchema,
} from './account.schemas';
import { ACCOUNT_MEDIA_STORAGE } from './account.tokens';

/**
 * The signed-in person's own profile (docs/adr/0071).
 *
 * Every role reaches it, because every role is a person: an editor who
 * writes the articles is exactly who an author page is for. Nothing here
 * takes a user id — the only account it can change is the one the session
 * belongs to, so there is no other person's profile to ask for.
 */
@Controller('account')
@UseGuards(SessionAuthGuard)
export class AccountController {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(ACCOUNT_MEDIA_STORAGE)
    private readonly mediaStorage: MediaStoragePort,
    @Inject(TENANT_CONTEXT)
    private readonly tenantContext: TenantContextPort,
  ) {}

  @Get('profile')
  profile() {
    return getAccountProfile(this.deps(), this.account());
  }

  @Patch('profile')
  update(
    @Body(new ZodValidationPipe(updateAccountProfileBodySchema))
    body: UpdateAccountProfileBody,
  ) {
    return updateAccountProfile(this.deps(), {
      ...this.account(),
      displayName: body.displayName,
      slug: body.slug,
      bio: body.bio,
    });
  }

  @Post('avatar')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      // A photo's ceiling, and refused before it is read: nothing else is
      // ever a profile picture.
      limits: { fileSize: MAX_UPLOAD_BYTES_BY_KIND.image },
    }),
  )
  changeAvatar(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return changeAccountAvatar(this.deps(), {
      ...this.account(),
      filename: file.originalname,
      mimeType: file.mimetype,
      data: file.buffer,
    });
  }

  @Delete('avatar')
  removeAvatar() {
    return removeAccountAvatar(this.deps(), this.account());
  }

  private deps() {
    return {
      userRepository: this.userRepository,
      mediaStorage: this.mediaStorage,
    };
  }

  private account() {
    return {
      tenantId: this.tenantContext.getCurrentTenantId(),
      userId: this.tenantContext.getCurrentUserId(),
    };
  }
}
