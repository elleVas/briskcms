import { describe, expect, it } from 'vitest';
import { User } from './user.js';

describe('User entity', () => {
  const baseInput = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'lele@example.com',
    displayName: 'Lele',
    passwordHash: 'hash-1',
    role: 'admin' as const,
  };

  it('create() exposes every prop via its getters', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const user = User.create({ ...baseInput, now });

    expect(user.id).toBe('user-1');
    expect(user.tenantId).toBe('tenant-1');
    expect(user.email).toBe('lele@example.com');
    expect(user.displayName).toBe('Lele');
    expect(user.passwordHash).toBe('hash-1');
    expect(user.role).toBe('admin');
    expect(user.isActive).toBe(true);
    expect(user.createdAt).toEqual(now);
  });

  it('create() defaults isActive to true, and to false when explicitly requested (invite flow)', () => {
    expect(User.create(baseInput).isActive).toBe(true);
    expect(User.create({ ...baseInput, isActive: false }).isActive).toBe(false);
  });

  it('changeRole/changeDisplayName replace the stored value', () => {
    const user = User.create(baseInput);

    user.changeRole('publisher');
    user.changeDisplayName('Raffaele');

    expect(user.role).toBe('publisher');
    expect(user.displayName).toBe('Raffaele');
  });

  it('deactivate/reactivate toggle isActive', () => {
    const user = User.create(baseInput);

    user.deactivate();
    expect(user.isActive).toBe(false);

    user.reactivate();
    expect(user.isActive).toBe(true);
  });

  it('starts unverified', () => {
    const user = User.create(baseInput);
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.isEmailVerified).toBe(false);
  });

  it('verifyEmail marks the email as verified', () => {
    const user = User.create(baseInput);
    const now = new Date('2026-01-01T00:00:00Z');

    user.verifyEmail(now);

    expect(user.emailVerifiedAt).toEqual(now);
    expect(user.isEmailVerified).toBe(true);
  });

  it('changePasswordHash replaces the stored hash', () => {
    const user = User.create(baseInput);

    user.changePasswordHash('hash-2');

    expect(user.passwordHash).toBe('hash-2');
  });

  it('fromProps/toProps round-trip without loss', () => {
    const props = {
      ...baseInput,
      isActive: true,
      emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
      createdAt: new Date('2025-12-01T00:00:00Z'),
    };

    const user = User.fromProps(props);

    expect(user.toProps()).toEqual(props);
  });
});
