import { describe, expect, it } from 'vitest';
import { InvalidOrExpiredTokenError, User } from '@brisk/domain-core';
import { requestPasswordReset } from './request-password-reset.use-case.js';
import { resetPassword } from './reset-password.use-case.js';
import { InMemoryUserRepository } from './in-memory-repositories.test-fixture.js';
import { FakeVerificationTokenPort } from './fake-verification-token-port.test-fixture.js';
import { FakeEmailPort } from './fake-email-port.test-fixture.js';
import { FakeAuthPort } from './fake-auth-port.test-fixture.js';

const tenantId = 'tenant-1';

async function setup() {
  const userRepository = new InMemoryUserRepository();
  const verificationTokenPort = new FakeVerificationTokenPort();
  const emailPort = new FakeEmailPort();
  const authPort = new FakeAuthPort();
  const user = User.create({
    id: 'user-1',
    tenantId,
    email: 'lele@example.com',
    passwordHash: await authPort.hashPassword('old-password'),
    role: 'admin',
  });
  await userRepository.save(user);
  return { userRepository, verificationTokenPort, emailPort, authPort, user };
}

describe('requestPasswordReset', () => {
  it('sends a reset email with a working link for a known email', async () => {
    const deps = await setup();

    await requestPasswordReset(deps, {
      tenantId,
      email: 'lele@example.com',
      resetUrlBase: 'https://editor.example.com/',
    });

    expect(deps.emailPort.sentEmails).toHaveLength(1);
    expect(deps.emailPort.sentEmails[0].html).toContain(
      'https://editor.example.com/reset-password?resetToken=',
    );
  });

  it('resolves silently (no email sent, no error) for an unknown email', async () => {
    const deps = await setup();

    await expect(
      requestPasswordReset(deps, {
        tenantId,
        email: 'nobody@example.com',
        resetUrlBase: 'https://editor.example.com/',
      }),
    ).resolves.toBeUndefined();
    expect(deps.emailPort.sentEmails).toHaveLength(0);
  });
});

describe('resetPassword', () => {
  it('updates the password and invalidates existing sessions', async () => {
    const deps = await setup();
    const session = await deps.authPort.createSession('user-1', tenantId);
    const token = await deps.verificationTokenPort.createToken(
      'user-1',
      tenantId,
      'password-reset',
      1000 * 60,
    );

    await resetPassword(deps, {
      token: token.token,
      newPassword: 'new-password',
    });

    const user = await deps.userRepository.findById(tenantId, 'user-1');
    expect(
      await deps.authPort.verifyPassword(
        'new-password',
        user?.passwordHash ?? '',
      ),
    ).toBe(true);
    expect(await deps.authPort.validateSession(session.token)).toBeNull();
  });

  it('throws InvalidOrExpiredTokenError for an unknown token', async () => {
    const deps = await setup();

    await expect(
      resetPassword(deps, { token: 'not-a-real-token', newPassword: 'x' }),
    ).rejects.toThrow(InvalidOrExpiredTokenError);
  });

  it('throws InvalidOrExpiredTokenError for a token issued for a different purpose', async () => {
    const deps = await setup();
    const token = await deps.verificationTokenPort.createToken(
      'user-1',
      tenantId,
      'email-verification',
      1000 * 60,
    );

    await expect(
      resetPassword(deps, { token: token.token, newPassword: 'x' }),
    ).rejects.toThrow(InvalidOrExpiredTokenError);
  });

  it('throws InvalidOrExpiredTokenError when the token references a user that no longer exists', async () => {
    const deps = await setup();
    const token = await deps.verificationTokenPort.createToken(
      'user-that-was-deleted',
      tenantId,
      'password-reset',
      1000 * 60,
    );

    await expect(
      resetPassword(deps, { token: token.token, newPassword: 'x' }),
    ).rejects.toThrow(InvalidOrExpiredTokenError);
  });

  it('is single-use: consuming the same token twice fails the second time', async () => {
    const deps = await setup();
    const token = await deps.verificationTokenPort.createToken(
      'user-1',
      tenantId,
      'password-reset',
      1000 * 60,
    );

    await resetPassword(deps, {
      token: token.token,
      newPassword: 'new-password',
    });

    await expect(
      resetPassword(deps, { token: token.token, newPassword: 'other' }),
    ).rejects.toThrow(InvalidOrExpiredTokenError);
  });
});
