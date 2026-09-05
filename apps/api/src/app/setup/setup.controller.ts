import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
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
import { SetupTokenRegistry } from './setup-token.registry';
import { DEPLOYMENT_BOOTSTRAP_PORT } from './setup.tokens';

/**
 * The first-run wizard's backend. Unauthenticated by necessity: it runs
 * when there is nobody to authenticate as. What gates it instead is that
 * the deployment is empty — checked here, and again inside the port's own
 * transaction, because two people opening the wizard at once is otherwise
 * a race with an admin account as the prize.
 *
 * Rate-limited, unlike it used to be. The old reasoning — "there is
 * exactly one request this endpoint will ever accept, and the emptiness
 * check rejects the rest" — stopped holding the moment a setup token was
 * added: there is now a secret to guess, and an unthrottled endpoint is
 * where you would guess it. 256 bits of entropy make that hopeless anyway;
 * the throttle is what keeps it hopeless if the token ever gets weaker.
 */
@Controller('setup')
export class SetupController {
  constructor(
    @Inject(DEPLOYMENT_BOOTSTRAP_PORT)
    private readonly deploymentBootstrapPort: DeploymentBootstrapPort,
    @Inject(AUTH_PORT) private readonly authPort: AuthPort,
    @Inject(DEPLOYMENT_TENANT_RESOLVER)
    private readonly tenant: DeploymentTenantResolver,
    private readonly setupToken: SetupTokenRegistry,
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
  // On the write alone, never on the controller. `GET /setup/status` is
  // polled by the editor on every route load, so a class-level guard puts
  // both in one bucket — a couple of page refreshes and the owner is
  // locked out of their own form by their own browser. Measured, not
  // guessed: that is exactly what happened the first time.
  @UseGuards(ThrottlerGuard)
  @Post()
  async bootstrap(
    @Body(new ZodValidationPipe(bootstrapDeploymentBodySchema))
    body: BootstrapDeploymentBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ tenantId: string; siteId: string; userId: string }> {
    // Before anything else, and before any password hashing: whoever is
    // asking has to prove they can read this server's logs. See
    // SetupTokenRegistry for why that is the bar.
    if (!this.setupToken.verify(body.setupToken)) {
      throw new UnauthorizedException(
        'Invalid setup token. It is printed in the API container log — ' +
          '`docker compose logs api` — and changes each time the API ' +
          'restarts, so use the most recent one.',
      );
    }

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
    // Spent: nothing can use it again, and there is no reason to keep a
    // live credential in memory for the rest of the process's life.
    this.setupToken.clear();

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
