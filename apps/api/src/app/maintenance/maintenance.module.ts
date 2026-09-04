import { Module } from '@nestjs/common';
import { type BriskDb } from '@brisk/postgres-db';
import { DATABASE, DatabaseModule } from '../database.module';
import { DeploymentTenantModule } from '../deployment-tenant.module';
import {
  DEPLOYMENT_TENANT_RESOLVER,
  type DeploymentTenantResolver,
} from '../deployment-tenant.resolver';
import { ExpiredTokensCleanupService } from './expired-tokens-cleanup.service';
import { FormSubmissionsRetentionCleanupService } from './form-submissions-retention-cleanup.service';

@Module({
  imports: [DeploymentTenantModule, DatabaseModule],
  providers: [
    {
      provide: ExpiredTokensCleanupService,
      useFactory: (db: BriskDb, tenant: DeploymentTenantResolver) =>
        new ExpiredTokensCleanupService(db, () => tenant.resolve()),
      inject: [DATABASE, DEPLOYMENT_TENANT_RESOLVER],
    },
    {
      provide: FormSubmissionsRetentionCleanupService,
      useFactory: (db: BriskDb, tenant: DeploymentTenantResolver) =>
        new FormSubmissionsRetentionCleanupService(db, () => tenant.resolve()),
      inject: [DATABASE, DEPLOYMENT_TENANT_RESOLVER],
    },
  ],
})
export class MaintenanceModule {}
