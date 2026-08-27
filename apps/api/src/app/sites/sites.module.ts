import { Module } from '@nestjs/common';
import { type BriskDb } from '@brisk/postgres-db';
import {
  DrizzleSiteRepository,
  DrizzleSiteThemeBlockStylesRepository,
} from '@brisk/postgres-site-repository';
import { AuthModule } from '../auth/auth.module.js';
import { DATABASE, DatabaseModule } from '../database.module.js';
import { SitesController } from './sites.controller.js';
import {
  SITE_REPOSITORY,
  SITE_THEME_BLOCK_STYLES_REPOSITORY,
} from './sites.tokens.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [SitesController],
  providers: [
    {
      provide: SITE_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleSiteRepository(db),
      inject: [DATABASE],
    },
    {
      provide: SITE_THEME_BLOCK_STYLES_REPOSITORY,
      useFactory: (db: BriskDb) =>
        new DrizzleSiteThemeBlockStylesRepository(db),
      inject: [DATABASE],
    },
  ],
})
export class SitesModule {}
