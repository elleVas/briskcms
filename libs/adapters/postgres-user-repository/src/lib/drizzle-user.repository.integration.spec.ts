import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User } from '@brisk/domain-core';
import { type BriskDb, createAppDb, tenants } from '@brisk/postgres-db';
import { DrizzleUserRepository } from './drizzle-user.repository.js';

/**
 * Runs against a real Postgres — see docs/development.md. Connects as
 * `brisk_app`, same as production code, so this is also the RLS regression
 * test for `users`.
 */
describe('DrizzleUserRepository (integration)', () => {
  let db: BriskDb;
  let userRepository: DrizzleUserRepository;
  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    db = createAppDb();
    userRepository = new DrizzleUserRepository(db);

    const [tenantA] = await db
      .insert(tenants)
      .values({ name: `Integration Tenant A ${randomUUID()}` })
      .returning({ id: tenants.id });
    const [tenantB] = await db
      .insert(tenants)
      .values({ name: `Integration Tenant B ${randomUUID()}` })
      .returning({ id: tenants.id });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;
  });

  afterAll(async () => {
    await db.$client.end();
  });

  function buildUser(
    overrides: Partial<Parameters<typeof User.create>[0]> = {},
  ) {
    return User.create({
      id: randomUUID(),
      tenantId: tenantAId,
      email: `user-${randomUUID()}@example.com`,
      passwordHash: 'irrelevant-for-this-suite',
      role: 'admin',
      ...overrides,
    });
  }

  it('saves and retrieves a user by id, scoped to its tenant', async () => {
    const user = buildUser();
    await userRepository.save(user);

    const found = await userRepository.findById(tenantAId, user.id);
    expect(found?.email).toBe(user.email);

    const foundFromOtherTenant = await userRepository.findById(
      tenantBId,
      user.id,
    );
    expect(foundFromOtherTenant).toBeNull();
  });

  it('findByEmail scopes by tenant', async () => {
    const user = buildUser();
    await userRepository.save(user);

    const found = await userRepository.findByEmail(tenantAId, user.email);
    expect(found?.id).toBe(user.id);

    const foundFromOtherTenant = await userRepository.findByEmail(
      tenantBId,
      user.email,
    );
    expect(foundFromOtherTenant).toBeNull();
  });

  it('save() upserts: a second save updates the same row instead of inserting a new one', async () => {
    const user = buildUser();
    await userRepository.save(user);

    user.changePasswordHash('a-new-hash');
    await userRepository.save(user);

    const found = await userRepository.findById(tenantAId, user.id);
    expect(found?.passwordHash).toBe('a-new-hash');
  });

  it('returns null for an email that does not exist', async () => {
    expect(
      await userRepository.findByEmail(tenantAId, 'nobody@example.com'),
    ).toBeNull();
  });
});
