import { Module } from '@nestjs/common';
import { type BriskDb } from '@brisk/postgres-db';
import {
  DrizzleSiteRepository,
  DrizzleSiteThemeBlockStylesRepository,
} from '@brisk/postgres-site-repository';
import type { SiteRepositoryPort } from '@brisk/ports';
import { AuthModule } from '../auth/auth.module';
import { DATABASE, DatabaseModule } from '../database.module';
import {
  DEPLOYMENT_SITE_RESOLVER,
  DeploymentSiteResolver,
} from './deployment-site.resolver';
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
    {
      provide: DEPLOYMENT_SITE_RESOLVER,
      // Same shape as DeploymentTenantModule's factory: the env var still
      // wins when set, so an existing deployment that pins it keeps
      // working untouched. Absent — the first-run wizard's case — the
      // resolver falls back to the tenant's only site.
      useFactory: (siteRepository: SiteRepositoryPort) =>
        new DeploymentSiteResolver(
          siteRepository,
          process.env['DEFAULT_SITE_ID'],
        ),
      inject: [SITE_REPOSITORY],
    },
  ],
})
export class SitesModule {}
