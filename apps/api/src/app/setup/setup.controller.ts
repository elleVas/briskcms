import { Body, Controller, Get, Inject, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { bootstrapDeployment } from '@brisk/application';
import type { AuthPort, DeploymentBootstrapPort } from '@brisk/ports';
import { AUTH_PORT } from '../auth/auth.tokens';
import {
  DEPLOYMENT_TENANT_RESOLVER,
  DeploymentTenantResolver,
} from '../deployment-tenant.resolver';
import {
  SESSION_COOKIE_MAX_AGE_MS,
  SESSION_COOKIE_NAME,
} from '../auth/session-cookie.constants';
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

  /**
   * Signs the new admin in as part of the same request, rather than
   * bouncing them to the login form with the credentials they typed ten
   * seconds ago.
   *
   * It is not a convenience: logging in separately would have to pass
   * Turnstile, whose keys are configured through the very env file this
   * wizard exists so a self-hoster does not have to edit. A fresh
   * deployment would send an empty token to a real secret key and be
   * refused, leaving someone locked out of the installation they just
   * created. Issuing the session here needs no captcha to be meaningful:
   * whoever completed setup demonstrably controlled an unclaimed
   * installation, which is a stronger proof than the one login asks for.
   */
  @Post()
  async bootstrap(
    @Body(new ZodValidationPipe(bootstrapDeploymentBodySchema))
    body: BootstrapDeploymentBody,
    @Res({ passthrough: true }) response: Response,
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

    const session = await this.authPort.createSession(
      result.userId,
      result.tenantId,
    );
    response.cookie(SESSION_COOKIE_NAME, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_COOKIE_MAX_AGE_MS,
    });

    return result;
  }
}
