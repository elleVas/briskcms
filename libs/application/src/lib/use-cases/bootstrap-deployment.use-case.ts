import { randomUUID } from 'node:crypto';
import { DeploymentAlreadySetUpError } from '@brisk/domain-core';
import type {
  AuthPort,
  BootstrapHomePage,
  DeploymentBootstrapPort,
} from '@brisk/ports';
import type { BootstrapDeploymentResult } from '@brisk/ports';

export interface BootstrapDeploymentDeps {
  deploymentBootstrapPort: DeploymentBootstrapPort;
  authPort: AuthPort;
}

export interface BootstrapDeploymentInput {
  siteName: string;
  defaultLocale: string;
  adminEmail: string;
  /** Plaintext, hashed here and never stored or logged as given. */
  adminPassword: string;
}

/**
 * The first-run wizard: turns an empty, freshly deployed Brisk into one
 * somebody can log into. It is the only write in the system that runs
 * without a tenant, because it is what creates one.
 *
 * Deliberately unauthenticated, and gated on emptiness instead: there is
 * nobody to authenticate as before it runs, which is the whole point. That
 * makes "has this already been set up?" the only thing standing between an
 * open endpoint and a stranger creating themselves an admin account, so it
 * is checked here *and* again inside the port's transaction — the check
 * and the write are otherwise a race between two people who both opened
 * the wizard.
 *
 * Password rules live at the edge (the request schema), not here, for the
 * same reason they do for invites: this use case's job is that the
 * deployment ends up in a usable state, not what counts as a good
 * password.
 */
export async function bootstrapDeployment(
  deps: BootstrapDeploymentDeps,
  input: BootstrapDeploymentInput,
): Promise<BootstrapDeploymentResult> {
  if (await deps.deploymentBootstrapPort.hasBeenSetUp()) {
    throw new DeploymentAlreadySetUpError();
  }

  const adminPasswordHash = await deps.authPort.hashPassword(
    input.adminPassword,
  );

  return deps.deploymentBootstrapPort.bootstrap({
    siteName: input.siteName,
    defaultLocale: input.defaultLocale,
    adminEmail: input.adminEmail,
    adminPasswordHash,
    homePage: buildStarterHomePage(input.siteName, input.defaultLocale),
  });
}

/**
 * What a brand-new site looks like before anyone has edited it.
 *
 * It exists because the alternative was worse than empty: a deployment
 * that had just completed setup served a 404 on its own homepage, with
 * nothing saying the site simply had no content yet. Seeding one published
 * page is the same answer WordPress and Ghost reached, for the same
 * reason.
 *
 * Only the title is filled in, from the name the admin just typed. The
 * subtitle is deliberately left empty rather than given placeholder copy:
 * the wizard collects a locale, not a language this code has strings for,
 * so any sentence here would be wrong in most installations — whereas an
 * empty field reads as one waiting to be filled, in every language.
 */
function buildStarterHomePage(
  siteName: string,
  defaultLocale: string,
): BootstrapHomePage {
  return {
    locale: defaultLocale,
    // The slug apps/public-site resolves `/<locale>/` to (see its
    // [locale]/index.astro) — anything else would leave the site's root
    // still 404ing, which is the whole point of seeding it.
    slug: 'home',
    title: siteName,
    content: [
      {
        id: randomUUID(),
        type: 'Hero',
        props: { title: siteName, subtitle: '' },
      },
    ],
  };
}
