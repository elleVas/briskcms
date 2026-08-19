import { describe, expect, it } from 'vitest';
import {
  InvalidOrExpiredTokenError,
  User,
  UserEmailAlreadyExistsError,
  UserNotFoundError,
} from '@brisk/domain-core';
import { inviteUser } from './invite-user.use-case.js';
import { acceptInvite } from './accept-invite.use-case.js';
import { updateUserRole } from './update-user-role.use-case.js';
import { setUserActive } from './set-user-active.use-case.js';
import { listUsers } from './list-users.use-case.js';
import { InMemoryUserRepository } from './in-memory-repositories.test-fixture.js';
import { FakeVerificationTokenPort } from './fake-verification-token-port.test-fixture.js';
import { FakeEmailPort } from './fake-email-port.test-fixture.js';
import { FakeAuthPort } from './fake-auth-port.test-fixture.js';

const tenantId = 'tenant-1';

function setup() {
  const userRepository = new InMemoryUserRepository();
  const verificationTokenPort = new FakeVerificationTokenPort();
  const emailPort = new FakeEmailPort();
  const authPort = new FakeAuthPort();
  return { userRepository, verificationTokenPort, emailPort, authPort };
}

describe('inviteUser', () => {
  it('creates an inactive user and emails an accept-invite link', async () => {
    const deps = setup();

    const user = await inviteUser(deps, {
      tenantId,
      email: 'nuovo@example.com',
      displayName: 'Nuovo Utente',
      role: 'editor',
      inviteUrlBase: 'https://editor.example.com/',
    });

    expect(user.isActive).toBe(false);
    expect(user.role).toBe('editor');
    expect(deps.emailPort.sentEmails).toHaveLength(1);
    expect(deps.emailPort.sentEmails[0].to).toBe('nuovo@example.com');
    expect(deps.emailPort.sentEmails[0].html).toContain(
      'https://editor.example.com/accept-invite?inviteToken=',
    );
    const saved = await deps.userRepository.findById(tenantId, user.id);
    expect(saved).not.toBeNull();
  });

  it('throws UserEmailAlreadyExistsError for an email already in use, sending no email', async () => {
    const deps = setup();
    await deps.userRepository.save(
      User.create({
        id: 'user-1',
        tenantId,
        email: 'esiste@example.com',
        displayName: 'Esistente',
        passwordHash: 'irrelevant',
        role: 'admin',
      }),
    );

    await expect(
      inviteUser(deps, {
        tenantId,
        email: 'esiste@example.com',
        displayName: 'Duplicato',
        role: 'editor',
        inviteUrlBase: 'https://editor.example.com/',
      }),
    ).rejects.toThrow(UserEmailAlreadyExistsError);
    expect(deps.emailPort.sentEmails).toHaveLength(0);
  });
});

describe('acceptInvite', () => {
  it('sets the new password and reactivates the user', async () => {
    const deps = setup();
    const user = User.create({
      id: 'user-1',
      tenantId,
      email: 'invitato@example.com',
      displayName: 'Invitato',
      passwordHash: 'unguessable',
      role: 'editor',
      isActive: false,
    });
    await deps.userRepository.save(user);
    const token = await deps.verificationTokenPort.createToken(
      user.id,
      tenantId,
      'user-invite',
      1000 * 60,
    );

    await acceptInvite(deps, { token: token.token, password: 'new-password' });

    const saved = await deps.userRepository.findById(tenantId, user.id);
    expect(saved?.isActive).toBe(true);
    expect(
      await deps.authPort.verifyPassword(
        'new-password',
        saved?.passwordHash ?? '',
      ),
    ).toBe(true);
  });

  it('throws InvalidOrExpiredTokenError for an unknown token', async () => {
    const deps = setup();

    await expect(
      acceptInvite(deps, { token: 'not-a-real-token', password: 'x' }),
    ).rejects.toThrow(InvalidOrExpiredTokenError);
  });

  it('throws InvalidOrExpiredTokenError for a token issued for a different purpose', async () => {
    const deps = setup();
    const user = User.create({
      id: 'user-1',
      tenantId,
      email: 'invitato@example.com',
      displayName: 'Invitato',
      passwordHash: 'unguessable',
      role: 'editor',
      isActive: false,
    });
    await deps.userRepository.save(user);
    const token = await deps.verificationTokenPort.createToken(
      user.id,
      tenantId,
      'password-reset',
      1000 * 60,
    );

    await expect(
      acceptInvite(deps, { token: token.token, password: 'x' }),
    ).rejects.toThrow(InvalidOrExpiredTokenError);
  });

  it('throws InvalidOrExpiredTokenError when the token references a user that no longer exists', async () => {
    const deps = setup();
    const token = await deps.verificationTokenPort.createToken(
      'user-that-was-deleted',
      tenantId,
      'user-invite',
      1000 * 60,
    );

    await expect(
      acceptInvite(deps, { token: token.token, password: 'x' }),
    ).rejects.toThrow(InvalidOrExpiredTokenError);
  });

  it('is single-use: consuming the same token twice fails the second time', async () => {
    const deps = setup();
    const user = User.create({
      id: 'user-1',
      tenantId,
      email: 'invitato@example.com',
      displayName: 'Invitato',
      passwordHash: 'unguessable',
      role: 'editor',
      isActive: false,
    });
    await deps.userRepository.save(user);
    const token = await deps.verificationTokenPort.createToken(
      user.id,
      tenantId,
      'user-invite',
      1000 * 60,
    );

    await acceptInvite(deps, { token: token.token, password: 'first' });

    await expect(
      acceptInvite(deps, { token: token.token, password: 'second' }),
    ).rejects.toThrow(InvalidOrExpiredTokenError);
  });
});

describe('updateUserRole', () => {
  it('changes the role and persists it', async () => {
    const deps = setup();
    const user = User.create({
      id: 'user-1',
      tenantId,
      email: 'lele@example.com',
      displayName: 'Lele',
      passwordHash: 'irrelevant',
      role: 'editor',
    });
    await deps.userRepository.save(user);

    const result = await updateUserRole(deps, {
      tenantId,
      userId: 'user-1',
      role: 'publisher',
    });

    expect(result.role).toBe('publisher');
    const saved = await deps.userRepository.findById(tenantId, 'user-1');
    expect(saved?.role).toBe('publisher');
  });

  it('throws UserNotFoundError for a user that does not exist', async () => {
    const deps = setup();

    await expect(
      updateUserRole(deps, {
        tenantId,
        userId: 'does-not-exist',
        role: 'admin',
      }),
    ).rejects.toThrow(UserNotFoundError);
  });
});

describe('setUserActive', () => {
  async function setupActiveUser(deps: ReturnType<typeof setup>) {
    const user = User.create({
      id: 'user-1',
      tenantId,
      email: 'lele@example.com',
      displayName: 'Lele',
      passwordHash: 'irrelevant',
      role: 'publisher',
    });
    await deps.userRepository.save(user);
    return user;
  }

  it('deactivates a user and invalidates its existing sessions', async () => {
    const deps = setup();
    await setupActiveUser(deps);
    const session = await deps.authPort.createSession('user-1', tenantId);

    const result = await setUserActive(deps, {
      tenantId,
      userId: 'user-1',
      isActive: false,
    });

    expect(result.isActive).toBe(false);
    const saved = await deps.userRepository.findById(tenantId, 'user-1');
    expect(saved?.isActive).toBe(false);
    expect(await deps.authPort.validateSession(session.token)).toBeNull();
  });

  it('reactivates a user without touching sessions', async () => {
    const deps = setup();
    const user = User.create({
      id: 'user-1',
      tenantId,
      email: 'lele@example.com',
      displayName: 'Lele',
      passwordHash: 'irrelevant',
      role: 'publisher',
      isActive: false,
    });
    await deps.userRepository.save(user);

    const result = await setUserActive(deps, {
      tenantId,
      userId: 'user-1',
      isActive: true,
    });

    expect(result.isActive).toBe(true);
  });

  it('throws UserNotFoundError for a user that does not exist', async () => {
    const deps = setup();

    await expect(
      setUserActive(deps, {
        tenantId,
        userId: 'does-not-exist',
        isActive: false,
      }),
    ).rejects.toThrow(UserNotFoundError);
  });
});

describe('listUsers', () => {
  it('paginates users scoped to the tenant', async () => {
    const deps = setup();
    for (let i = 0; i < 3; i++) {
      await deps.userRepository.save(
        User.create({
          id: `user-${i}`,
          tenantId,
          email: `user-${i}@example.com`,
          displayName: `User ${i}`,
          passwordHash: 'irrelevant',
          role: 'editor',
        }),
      );
    }
    await deps.userRepository.save(
      User.create({
        id: 'other-tenant-user',
        tenantId: 'tenant-2',
        email: 'other@example.com',
        displayName: 'Other',
        passwordHash: 'irrelevant',
        role: 'editor',
      }),
    );

    const result = await listUsers(deps, {
      tenantId,
      page: 1,
      pageSize: 2,
    });

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(3);
  });
});
