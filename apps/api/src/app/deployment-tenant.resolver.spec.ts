import type { BriskDb } from '@brisk/postgres-db';
import { DeploymentTenantResolver } from './deployment-tenant.resolver';

/** A `db` that answers the resolver's one query with `rows`, counting calls. */
function fakeDb(rows: { id: string }[]) {
  const limit = jest.fn().mockResolvedValue(rows);
  const from = jest.fn().mockReturnValue({ limit });
  const select = jest.fn().mockReturnValue({ from });
  return { db: { select } as unknown as BriskDb, limit };
}

describe('DeploymentTenantResolver', () => {
  it('prefers DEFAULT_TENANT_ID and never touches the database', async () => {
    const { db, limit } = fakeDb([{ id: 'from-db' }]);
    const resolver = new DeploymentTenantResolver(db, 'from-env');

    expect(await resolver.resolve()).toBe('from-env');
    expect(limit).not.toHaveBeenCalled();
  });

  it('falls back to the single tenant row when the env var is unset', async () => {
    const { db } = fakeDb([{ id: 'the-only-tenant' }]);

    expect(await new DeploymentTenantResolver(db, undefined).resolve()).toBe(
      'the-only-tenant',
    );
  });

  it('resolves to null when nothing has been set up yet', async () => {
    const { db } = fakeDb([]);

    expect(
      await new DeploymentTenantResolver(db, undefined).resolve(),
    ).toBeNull();
  });

  it('queries once and caches the answer', async () => {
    const { db, limit } = fakeDb([{ id: 't1' }]);
    const resolver = new DeploymentTenantResolver(db, undefined);

    await resolver.resolve();
    await resolver.resolve();

    expect(limit).toHaveBeenCalledTimes(1);
  });

  it('refuses to guess when more than one tenant exists', async () => {
    const { db } = fakeDb([{ id: 'a' }, { id: 'b' }]);

    await expect(
      new DeploymentTenantResolver(db, undefined).resolve(),
    ).rejects.toThrow(/single-tenant per deployment/);
  });

  it('re-queries after refresh() when the last answer was "not set up"', async () => {
    // What the wizard relies on: the process was already running, and
    // answering "no tenant", when setup created one.
    const limit = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'just-created' }]);
    const db = {
      select: () => ({ from: () => ({ limit }) }),
    } as unknown as BriskDb;
    const resolver = new DeploymentTenantResolver(db, undefined);

    expect(await resolver.resolve()).toBeNull();
    resolver.refresh();

    expect(await resolver.resolve()).toBe('just-created');
  });

  it('keeps a resolved id across refresh()', async () => {
    const { db, limit } = fakeDb([{ id: 'settled' }]);
    const resolver = new DeploymentTenantResolver(db, undefined);

    await resolver.resolve();
    resolver.refresh();

    expect(await resolver.resolve()).toBe('settled');
    expect(limit).toHaveBeenCalledTimes(1);
  });
});

describe('DeploymentTenantResolver.require', () => {
  it('returns the id when there is one', async () => {
    const { db } = fakeDb([{ id: 'set-up' }]);

    expect(await new DeploymentTenantResolver(db, undefined).require()).toBe(
      'set-up',
    );
  });

  it('throws rather than returning null when nothing is set up', async () => {
    const { db } = fakeDb([]);

    await expect(
      new DeploymentTenantResolver(db, undefined).require(),
    ).rejects.toThrow(/has not been set up/);
  });
});
