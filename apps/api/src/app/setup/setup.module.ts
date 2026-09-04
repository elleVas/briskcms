import { Module } from '@nestjs/common';
import {
  DrizzleDeploymentBootstrapAdapter,
  type BriskDb,
} from '@brisk/postgres-db';
import { SessionAuthAdapter } from '@brisk/session-auth-adapter';
import { AUTH_PORT } from '../auth/auth.tokens';
import { DATABASE, DatabaseModule } from '../database.module';
import { DeploymentTenantModule } from '../deployment-tenant.module';
import {
  DEPLOYMENT_TENANT_RESOLVER,
  type DeploymentTenantResolver,
} from '../deployment-tenant.resolver';
import { SetupController } from './setup.controller';
import { DEPLOYMENT_BOOTSTRAP_PORT } from './setup.tokens';

/**
 * Its own AUTH_PORT rather than importing AuthModule, the same pattern the
 * public modules use: this one needs `hashPassword` and nothing else, and
 * importing AuthModule would pull in the throttlers, the captcha and the
 * email transport for a single call.
 */
@Module({
  imports: [DatabaseModule, DeploymentTenantModule],
  controllers: [SetupController],
  providers: [
    {
      provide: DEPLOYMENT_BOOTSTRAP_PORT,
      useFactory: (db: BriskDb) => new DrizzleDeploymentBootstrapAdapter(db),
      inject: [DATABASE],
    },
    {
      provide: AUTH_PORT,
      useFactory: (db: BriskDb, tenant: DeploymentTenantResolver) =>
        new SessionAuthAdapter(db, () => tenant.require()),
      inject: [DATABASE, DEPLOYMENT_TENANT_RESOLVER],
    },
  ],
})
export class SetupModule {}
