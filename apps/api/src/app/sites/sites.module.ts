import { Module } from '@nestjs/common';
import { type BriskDb } from '@brisk/postgres-db';
import {
  DrizzleSiteRepository,
  DrizzleSiteThemeBlockStylesRepository,
} from '@brisk/postgres-site-repository';
import { AuthModule } from '../auth/auth.module';
import { DATABASE, DatabaseModule } from '../database.module';
import { SitesController } from './sites.controller';
import { createThemeCatalog } from '../themes/theme-catalog.factory';
import {
  SITE_REPOSITORY,
  SITE_THEME_BLOCK_STYLES_REPOSITORY,
  THEME_CATALOG,
} from './sites.tokens';

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
    {
      provide: THEME_CATALOG,
      useFactory: createThemeCatalog,
    },
  ],
})
export class SitesModule {}
