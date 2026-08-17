import { describe, expect, it } from 'vitest';
import { InvalidCredentialsError, User } from '@brisk/domain-core';
import { loginUser } from './login-user.use-case.js';
import { logoutUser } from './logout-user.use-case.js';
import { InMemoryUserRepository } from './in-memory-repositories.test-fixture.js';
import { FakeAuthPort } from './fake-auth-port.test-fixture.js';

const tenantId = 'tenant-1';

async function setup() {
  const userRepository = new InMemoryUserRepository();
  const authPort = new FakeAuthPort();
  const passwordHash = await authPort.hashPassword('correct-horse-battery');
  const user = User.create({
    id: 'user-1',
    tenantId,
    email: 'lele@example.com',
    passwordHash,
    role: 'admin',
  });
  await userRepository.save(user);
  return { userRepository, authPort, user };
}

describe('loginUser', () => {
  it('creates a session for correct credentials', async () => {
    const deps = await setup();

    const session = await loginUser(deps, {
      tenantId,
      email: 'lele@example.com',
      password: 'correct-horse-battery',
    });

    expect(session.userId).toBe('user-1');
    expect(session.tenantId).toBe(tenantId);
  });

  it('throws InvalidCredentialsError for an unknown email', async () => {
    const deps = await setup();

    await expect(
      loginUser(deps, {
        tenantId,
        email: 'nobody@example.com',
        password: 'irrelevant',
      }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('throws InvalidCredentialsError for the wrong password', async () => {
    const deps = await setup();

    await expect(
      loginUser(deps, {
        tenantId,
        email: 'lele@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toThrow(InvalidCredentialsError);
  });
});

describe('logoutUser', () => {
  it('invalidates the session so it no longer validates', async () => {
    const deps = await setup();
    const session = await loginUser(deps, {
      tenantId,
      email: 'lele@example.com',
      password: 'correct-horse-battery',
    });

    await logoutUser(deps, { token: session.token });

    expect(await deps.authPort.validateSession(session.token)).toBeNull();
  });
});
