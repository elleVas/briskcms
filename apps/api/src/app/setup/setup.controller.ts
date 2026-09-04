import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { bootstrapDeployment } from '@brisk/application';
import type { AuthPort, DeploymentBootstrapPort } from '@brisk/ports';
import { AUTH_PORT } from '../auth/auth.tokens';
import {
  DEPLOYMENT_TENANT_RESOLVER,
  DeploymentTenantResolver,
} from '../deployment-tenant.resolver';
import { ZodValidationPipe } from '../zod-validation.pipe';
import {
  bootstrapDeploymentBodySchema,
  type BootstrapDeploymentBody,
} from './setup.schemas';
import { DEPLOYMENT_BOOTSTRAP_PORT } from './setup.tokens';

/**
 * The first-run wizard's backend. Unauthenticated by necessity: it runs
 * when there is nobody to authenticate as. What gates it instead is that
 * the deployment is empty — checked here, and again inside the port's own
 * transaction, because two people opening the wizard at once is otherwise
 * a race with an admin account as the prize.
 *
 * Not rate-limited, unlike login: there is exactly one request this
 * endpoint will ever accept in the life of an installation, and every
 * subsequent one is rejected by the emptiness check regardless of who
 * sends it or how often.
 */
@Controller('setup')
export class SetupController {
  constructor(
    @Inject(DEPLOYMENT_BOOTSTRAP_PORT)
    private readonly deploymentBootstrapPort: DeploymentBootstrapPort,
    @Inject(AUTH_PORT) private readonly authPort: AuthPort,
    @Inject(DEPLOYMENT_TENANT_RESOLVER)
    private readonly tenant: DeploymentTenantResolver,
  ) {}

  /**
   * What the editor loads before showing anything: the wizard when this is
   * false, the login page when it is true. Deliberately says nothing else
   * — no version, no hostname, no counts. It is reachable by anyone on the
   * internet, and "is this installation still unclaimed?" is already the
   * most useful thing it could tell an attacker.
   */
  @Get('status')
  async status(): Promise<{ hasBeenSetUp: boolean }> {
    return { hasBeenSetUp: await this.deploymentBootstrapPort.hasBeenSetUp() };
  }

  @Post()
  async bootstrap(
    @Body(new ZodValidationPipe(bootstrapDeploymentBodySchema))
    body: BootstrapDeploymentBody,
  ): Promise<{ tenantId: string; siteId: string; userId: string }> {
    const result = await bootstrapDeployment(
      {
        deploymentBootstrapPort: this.deploymentBootstrapPort,
        authPort: this.authPort,
      },
      body,
    );

    // The process has been answering "not set up" and caching that. Without
    // this, the login the wizard performs next would fail against a tenant
    // that demonstrably exists — see DeploymentTenantResolver.refresh().
    this.tenant.refresh();

    return result;
  }
}
