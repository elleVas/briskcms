export interface BootstrapDeploymentInput {
  siteName: string;
  /** BCP-47, and the site's only enabled locale to start with. */
  defaultLocale: string;
  adminEmail: string;
  /** Already hashed by AuthPort — a plaintext password never reaches this port. */
  adminPasswordHash: string;
}

export interface BootstrapDeploymentResult {
  tenantId: string;
  siteId: string;
  userId: string;
}

/**
 * The one write that happens before this deployment has a tenant at all —
 * the first-run wizard's own. It exists as its own port rather than as
 * three calls to the site/user repositories for two reasons.
 *
 * It has to be one transaction. A deployment left with a tenant but no
 * admin is unreachable: nobody can log in, and the wizard will not run
 * again because a tenant now exists. That is a bricked install, and it is
 * the exact failure a partial write produces.
 *
 * And every other repository takes a `tenantId` it can be scoped to
 * (see the port comments there) — this one cannot, because it is what
 * creates it. Keeping that single exception in a port of its own is what
 * lets the rule stay absolute everywhere else.
 */
export interface DeploymentBootstrapPort {
  /**
   * Whether this deployment has already been set up. The wizard's gate:
   * both the status the editor reads and the check the write itself
   * repeats, since anything else is a race between two people opening the
   * wizard at once.
   */
  hasBeenSetUp(): Promise<boolean>;

  /** Creates tenant, site and admin user together, or none of them. */
  bootstrap(
    input: BootstrapDeploymentInput,
  ): Promise<BootstrapDeploymentResult>;
}
