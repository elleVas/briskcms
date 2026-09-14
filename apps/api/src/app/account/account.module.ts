import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module';
import { createMediaStorage } from '../media/media.module';
import { AccountController } from './account.controller';
import { ACCOUNT_MEDIA_STORAGE } from './account.tokens';

@Module({
  imports: [
    AuthModule,
    // The media library's limit, for the same reason: a profile picture
    // is an upload, and one account could otherwise fill the storage.
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 30 }] }),
  ],
  controllers: [AccountController],
  providers: [
    { provide: ACCOUNT_MEDIA_STORAGE, useFactory: createMediaStorage },
  ],
})
export class AccountModule {}
