import { describe, expect, it, vi } from 'vitest';
import {
  InvalidCredentialsError,
  User,
  UserNotActiveError,
} from '@brisk/domain-core';
import type { AuthPort, Session, UserRepositoryPort } from '@brisk/ports';
import { loginUser } from './login-user.use-case.js';

const tenantId = 'tenant-1';

function buildUser(overrides: { isActive?: boolean } = {}) {
  return User.create({
    id: 'user-1',
    tenantId,
    email: 'lele@example.com',
    displayName: 'Lele',
    passwordHash: 'hashed',
    role: 'admin',
    isActive: overrides.isActive,
  });
}

describe('loginUser', () => {
  it('creates a session when the account is active and the password matches', async () => {
    const userRepository = {
      findByEmail: vi.fn().mockResolvedValue(buildUser({ isActive: true })),
    } as unknown as UserRepositoryPort;
    const session: Session = {
      token: 'a-token',
      userId: 'user-1',
      tenantId,
      expiresAt: new Date(),
    };
    const authPort = {
      verifyPassword: vi.fn().mockResolvedValue(true),
      createSession: vi.fn().mockResolvedValue(session),
    } as unknown as AuthPort;

    const result = await loginUser(
      { userRepository, authPort },
      { tenantId, email: 'lele@example.com', password: 'correct' },
    );

    expect(result).toBe(session);
  });

  it('rejects a deactivated account even with the correct password', async () => {
    const userRepository = {
      findByEmail: vi.fn().mockResolvedValue(buildUser({ isActive: false })),
    } as unknown as UserRepositoryPort;
    const authPort = {
      verifyPassword: vi.fn().mockResolvedValue(true),
      createSession: vi.fn(),
    } as unknown as AuthPort;

    await expect(
      loginUser(
        { userRepository, authPort },
        { tenantId, email: 'lele@example.com', password: 'correct' },
      ),
    ).rejects.toThrow(UserNotActiveError);
    expect(authPort.createSession).not.toHaveBeenCalled();
  });

  it('checks the password before isActive, so a wrong password never reveals deactivation status', async () => {
    const userRepository = {
      findByEmail: vi.fn().mockResolvedValue(buildUser({ isActive: false })),
    } as unknown as UserRepositoryPort;
    const authPort = {
      verifyPassword: vi.fn().mockResolvedValue(false),
      createSession: vi.fn(),
    } as unknown as AuthPort;

    await expect(
      loginUser(
        { userRepository, authPort },
        { tenantId, email: 'lele@example.com', password: 'wrong' },
      ),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('rejects an unknown email', async () => {
    const userRepository = {
      findByEmail: vi.fn().mockResolvedValue(null),
    } as unknown as UserRepositoryPort;
    const authPort = {
      verifyPassword: vi.fn(),
      createSession: vi.fn(),
    } as unknown as AuthPort;

    await expect(
      loginUser(
        { userRepository, authPort },
        { tenantId, email: 'nobody@example.com', password: 'irrelevant' },
      ),
    ).rejects.toThrow(InvalidCredentialsError);
    expect(authPort.verifyPassword).not.toHaveBeenCalled();
  });
});
