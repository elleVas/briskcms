import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { requireEnv } from '@brisk/env-config';
import { type BriskDb } from '@brisk/postgres-db';
import { DrizzlePageRepository } from '@brisk/postgres-page-repository';
import { DrizzleSiteLayoutSectionRepository } from '@brisk/postgres-site-layout-section-repository';
import { DrizzleSiteRepository } from '@brisk/postgres-site-repository';
import { DATABASE, DatabaseModule } from '../database.module.js';
import { PublicPagesController } from './public-pages.controller.js';
import {
  DEFAULT_TENANT_ID,
  PAGE_REPOSITORY,
  SITE_LAYOUT_SECTION_REPOSITORY,
  SITE_REPOSITORY,
} from './public-pages.tokens.js';

@Module({
  imports: [
    DatabaseModule,
    // Generous limit tuned for real page-view traffic, not login-attempt
    // strictness (compare AuthModule's throttler) — this endpoint is hit on
    // every public page load, not just a rare auth action. A separate
    // ThrottlerModule instance, not a shared one with AuthModule, so
    // changing one limit can never accidentally change the other.
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 120 }] }),
  ],
  controllers: [PublicPagesController],
  providers: [
    // Its own DEFAULT_TENANT_ID provider rather than importing AuthModule
    // for the one it already has: AuthModule also wires SMTP/email/session
    // providers this module has no business depending on to boot.
    {
      provide: DEFAULT_TENANT_ID,
      useFactory: (): string => requireEnv('DEFAULT_TENANT_ID'),
    },
    {
      provide: PAGE_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzlePageRepository(db),
      inject: [DATABASE],
    },
    {
      provide: SITE_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleSiteRepository(db),
      inject: [DATABASE],
    },
    {
      provide: SITE_LAYOUT_SECTION_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleSiteLayoutSectionRepository(db),
      inject: [DATABASE],
    },
  ],
})
export class PublicPagesModule {}
