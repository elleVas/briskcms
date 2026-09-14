import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  User,
  UserEmailAlreadyExistsError,
  UserSlugAlreadyExistsError,
} from '@brisk/domain-core';
import {
  type BriskDb,
  createAppDb,
  deleteIntegrationTenants,
  tenants,
} from '@brisk/postgres-db';
import { DrizzleUserRepository } from './drizzle-user.repository';

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
    await deleteIntegrationTenants(db, [tenantAId, tenantBId]);
    await db.$client.end();
  });

  function buildUser(
    overrides: Partial<Parameters<typeof User.create>[0]> = {},
  ) {
    return User.create({
      id: randomUUID(),
      tenantId: tenantAId,
      email: `user-${randomUUID()}@example.com`,
      displayName: 'Test User',
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

  // Regression: inviteUser's check-then-act isn't atomic — under real
  // concurrency (two near-simultaneous invites to the same email) the
  // second insert must still fail with the domain error, not a raw
  // PostgresError. Simulated here by skipping the use-case's own check
  // entirely and saving two users with the same email directly.
  it('save() rejects a second user with the same tenant/email with UserEmailAlreadyExistsError', async () => {
    const email = `duplicate-${randomUUID()}@example.com`;
    const first = buildUser({ email });
    await userRepository.save(first);

    const second = buildUser({ email });
    await expect(userRepository.save(second)).rejects.toThrow(
      UserEmailAlreadyExistsError,
    );
  });

  describe('the author profile', () => {
    it('stores and reads back the address, the former ones, the bio and the picture', async () => {
      const user = buildUser({ slug: `giulia-${randomUUID()}` });
      user.changeSlug(`giulia-rossi-${randomUUID()}`);
      user.changeBio({ it: 'Scrive di caffè', en: 'Writes about coffee' });
      user.changeAvatar({ storageKey: 'face.webp', width: 256, height: 240 });
      await userRepository.save(user);

      const found = await userRepository.findById(tenantAId, user.id);
      expect(found?.toProps()).toEqual(user.toProps());
    });

    it('finds a person by their address, and by an address they left', async () => {
      const first = `mario-${randomUUID()}`;
      const second = `mario-rossi-${randomUUID()}`;
      const user = buildUser({ slug: first });
      user.changeSlug(second);
      await userRepository.save(user);

      expect((await userRepository.findBySlug(tenantAId, second))?.id).toBe(
        user.id,
      );
      expect(await userRepository.findBySlug(tenantAId, first)).toBeNull();
      expect(
        (await userRepository.findByFormerSlug(tenantAId, first))?.id,
      ).toBe(user.id);
      expect(await userRepository.findBySlug(tenantBId, second)).toBeNull();
    });

    it('counts an address as taken whether it is current or former, except for its owner', async () => {
      const former = `anna-${randomUUID()}`;
      const current = `anna-b-${randomUUID()}`;
      const user = buildUser({ slug: former });
      user.changeSlug(current);
      await userRepository.save(user);

      expect(await userRepository.isSlugTaken(tenantAId, current, null)).toBe(
        true,
      );
      expect(await userRepository.isSlugTaken(tenantAId, former, null)).toBe(
        true,
      );
      expect(
        await userRepository.isSlugTaken(tenantAId, current, user.id),
      ).toBe(false);
      expect(await userRepository.isSlugTaken(tenantBId, current, null)).toBe(
        false,
      );
    });

    it('refuses two people at the same address in one tenant, and lets any number have none', async () => {
      const slug = `same-${randomUUID()}`;
      await userRepository.save(buildUser({ slug }));
      await expect(userRepository.save(buildUser({ slug }))).rejects.toThrow(
        UserSlugAlreadyExistsError,
      );

      await userRepository.save(buildUser({ slug: null }));
      await userRepository.save(buildUser({ slug: null }));
    });

    /*
     * A profile saved from a copy read before an admin switched the person
     * off must not switch them back on: the profile writes its own columns
     * and no others.
     */
    it('saves a profile or a picture without touching role, status or each other', async () => {
      const user = buildUser({ slug: `luca-${randomUUID()}` });
      await userRepository.save(user);
      const readByThePerson = await userRepository.findById(tenantAId, user.id);
      const readByTheUpload = await userRepository.findById(tenantAId, user.id);
      if (!readByThePerson || !readByTheUpload) throw new Error('not saved');

      const readByTheAdmin = await userRepository.findById(tenantAId, user.id);
      readByTheAdmin?.deactivate();
      readByTheAdmin?.changeRole('editor');
      if (readByTheAdmin) await userRepository.save(readByTheAdmin);

      readByTheUpload.changeAvatar({
        storageKey: 'new.webp',
        width: 10,
        height: 10,
      });
      await userRepository.saveAvatar(readByTheUpload);
      readByThePerson.changeDisplayName('Luca Verdi');
      readByThePerson.changeBio({ it: 'Fotografo' });
      await userRepository.saveProfile(readByThePerson);

      const stored = await userRepository.findById(tenantAId, user.id);
      expect(stored?.isActive).toBe(false);
      expect(stored?.role).toBe('editor');
      expect(stored?.displayName).toBe('Luca Verdi');
      expect(stored?.bio).toEqual({ it: 'Fotografo' });
      expect(stored?.avatar?.storageKey).toBe('new.webp');
    });

    it('refuses a profile saved onto an address someone else has', async () => {
      const slug = `taken-${randomUUID()}`;
      await userRepository.save(buildUser({ slug }));
      const other = buildUser({ slug: null });
      await userRepository.save(other);

      other.changeSlug(slug);
      await expect(userRepository.saveProfile(other)).rejects.toThrow(
        UserSlugAlreadyExistsError,
      );
    });
  });
});
