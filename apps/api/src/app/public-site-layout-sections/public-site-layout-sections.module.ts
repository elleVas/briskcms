import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { requireEnv } from '@brisk/env-config';
import { type BriskDb } from '@brisk/postgres-db';
import { DrizzleSiteLayoutSectionRepository } from '@brisk/postgres-site-layout-section-repository';
import { PreviewTokenAdapter } from '@brisk/preview-token-adapter';
import { DATABASE, DatabaseModule } from '../database.module';
import { DeploymentTenantModule } from '../deployment-tenant.module';
import { PublicSiteLayoutSectionsController } from './public-site-layout-sections.controller';
import {
  PREVIEW_TOKEN_PORT,
  SITE_LAYOUT_SECTION_REPOSITORY,
} from './public-site-layout-sections.tokens';

@Module({
  imports: [
    DeploymentTenantModule,
    DatabaseModule,
    // Own instance, same limit as PublicPagesModule's — this is the same
    // kind of public-preview traffic pattern, not shared with it.
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 120 }] }),
  ],
  controllers: [PublicSiteLayoutSectionsController],
  providers: [
    {
      provide: SITE_LAYOUT_SECTION_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleSiteLayoutSectionRepository(db),
      inject: [DATABASE],
    },
    {
      provide: PREVIEW_TOKEN_PORT,
      useFactory: () =>
        new PreviewTokenAdapter(requireEnv('PREVIEW_TOKEN_SECRET')),
    },
  ],
})
export class PublicSiteLayoutSectionsModule {}
