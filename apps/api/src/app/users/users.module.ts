import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { createMediaStorage } from '../media/media.module';
import { UsersController } from './users.controller';
import { USERS_MEDIA_STORAGE } from './users.tokens';

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  // Only to show each person's picture in the list.
  providers: [{ provide: USERS_MEDIA_STORAGE, useFactory: createMediaStorage }],
})
export class UsersModule {}
