import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
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
import { SetupTokenRegistry } from './setup-token.registry';
import { DEPLOYMENT_BOOTSTRAP_PORT } from './setup.tokens';

/**
 * Its own AUTH_PORT rather than importing AuthModule, the same pattern the
 * public modules use: this one needs `hashPassword` and nothing else, and
 * importing AuthModule would pull in the throttlers, the captcha and the
 * email transport for a single call.
 */
@Module({
  imports: [
    DatabaseModule,
    DeploymentTenantModule,
    // Same window and limit AuthModule uses for login. Declared here rather
    // than shared: ThrottlerModule.forRoot is per-module in this codebase,
    // and SetupModule deliberately does not import AuthModule (see below).
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 5 }] }),
  ],
  controllers: [SetupController],
  providers: [
    SetupTokenRegistry,
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
