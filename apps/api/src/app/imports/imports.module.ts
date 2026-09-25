import { Module } from '@nestjs/common';
import { type BriskDb } from '@brisk/postgres-db';
import { DrizzleImportJobRepository } from '@brisk/postgres-import-job-repository';
import { DrizzleSiteRepository } from '@brisk/postgres-site-repository';
import { WxrExportReader } from '@brisk/wordpress-wxr';
import { AuthModule } from '../auth/auth.module';
import { DATABASE, DatabaseModule } from '../database.module';
import { DeploymentTenantModule } from '../deployment-tenant.module';
import {
  DEPLOYMENT_TENANT_RESOLVER,
  type DeploymentTenantResolver,
} from '../deployment-tenant.resolver';
import { AbandonedImportJobsService } from './abandoned-import-jobs.service';
import { ImportsController } from './imports.controller';
import {
  IMPORT_JOB_REPOSITORY,
  SITE_REPOSITORY,
  WORDPRESS_EXPORT_READER,
} from './imports.tokens';

@Module({
  imports: [DatabaseModule, AuthModule, DeploymentTenantModule],
  controllers: [ImportsController],
  providers: [
    {
      provide: IMPORT_JOB_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleImportJobRepository(db),
      inject: [DATABASE],
    },
    {
      // Only to refuse an upload aimed at a site that is not this
      // tenant's, before anything is written down.
      provide: SITE_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleSiteRepository(db),
      inject: [DATABASE],
    },
    {
      provide: WORDPRESS_EXPORT_READER,
      useClass: WxrExportReader,
    },
    {
      provide: AbandonedImportJobsService,
      useFactory: (
        importJobRepository: DrizzleImportJobRepository,
        tenant: DeploymentTenantResolver,
      ) =>
        new AbandonedImportJobsService(importJobRepository, () =>
          tenant.resolve(),
        ),
      inject: [IMPORT_JOB_REPOSITORY, DEPLOYMENT_TENANT_RESOLVER],
    },
  ],
  exports: [IMPORT_JOB_REPOSITORY],
})
export class ImportsModule {}
