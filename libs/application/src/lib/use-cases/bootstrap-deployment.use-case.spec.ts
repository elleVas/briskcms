import { describe, expect, it, vi } from 'vitest';
import { DeploymentAlreadySetUpError } from '@brisk/domain-core';
import type { AuthPort, DeploymentBootstrapPort } from '@brisk/ports';
import { bootstrapDeployment } from './bootstrap-deployment.use-case';

const INPUT = {
  siteName: 'Acme',
  defaultLocale: 'it',
  adminEmail: 'admin@acme.test',
  adminPassword: 'a-long-enough-password',
};

function deps(hasBeenSetUp: boolean) {
  const bootstrap = vi
    .fn()
    .mockResolvedValue({ tenantId: 't', siteId: 's', userId: 'u' });
  const hashPassword = vi.fn().mockResolvedValue('$argon2id$hashed');
  return {
    deps: {
      deploymentBootstrapPort: {
        hasBeenSetUp: vi.fn().mockResolvedValue(hasBeenSetUp),
        bootstrap,
      } as DeploymentBootstrapPort,
      authPort: { hashPassword } as unknown as AuthPort,
    },
    bootstrap,
    hashPassword,
  };
}

describe('bootstrapDeployment', () => {
  it('creates the tenant, site and admin and returns their ids', async () => {
    const { deps: d, bootstrap } = deps(false);

    expect(await bootstrapDeployment(d, INPUT)).toEqual({
      tenantId: 't',
      siteId: 's',
      userId: 'u',
    });
    expect(bootstrap).toHaveBeenCalledTimes(1);
  });

  it('hashes the password and never passes the plaintext on', async () => {
    const { deps: d, bootstrap, hashPassword } = deps(false);

    await bootstrapDeployment(d, INPUT);

    expect(hashPassword).toHaveBeenCalledWith(INPUT.adminPassword);
    const passed = bootstrap.mock.calls[0][0];
    expect(passed.adminPasswordHash).toBe('$argon2id$hashed');
    expect(JSON.stringify(passed)).not.toContain(INPUT.adminPassword);
  });

  it('enables the default locale on the new site', async () => {
    // A site whose default locale is not among its enabled ones resolves no
    // pages at all — the wizard is the one place nobody can fix that from.
    const { deps: d, bootstrap } = deps(false);

    await bootstrapDeployment(d, INPUT);

    expect(bootstrap.mock.calls[0][0].defaultLocale).toBe('it');
  });

  it('refuses on a deployment that already has a tenant', async () => {
    const { deps: d, bootstrap } = deps(true);

    await expect(bootstrapDeployment(d, INPUT)).rejects.toThrow(
      DeploymentAlreadySetUpError,
    );
    expect(bootstrap).not.toHaveBeenCalled();
  });

  it('does not even hash the password when already set up', async () => {
    // Cheap, but it is the difference between an endpoint a stranger can
    // make do argon2id work on demand and one that answers immediately.
    const { deps: d, hashPassword } = deps(true);

    await expect(bootstrapDeployment(d, INPUT)).rejects.toThrow();
    expect(hashPassword).not.toHaveBeenCalled();
  });
});
