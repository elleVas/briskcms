import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { User } from '@brisk/domain-core';
import type { UserRepositoryPort } from '@brisk/ports';
import { RolesGuard } from './roles.guard.js';
import type { AuthenticatedRequest } from './session-auth.guard.js';

const tenantId = 'tenant-1';

function buildUser(overrides: Partial<Parameters<typeof User.create>[0]> = {}) {
  return User.create({
    id: 'user-1',
    tenantId,
    email: 'lele@example.com',
    displayName: 'Lele',
    passwordHash: 'hashed',
    role: 'admin',
    ...overrides,
  });
}

// Express's Request has 100+ members — only `tenantId`/`userId` are read
// here, so a minimal double stands in via `unknown` rather than
// implementing the whole interface.
function buildContext(requiredRoles: string[] | undefined) {
  const request = {
    tenantId,
    userId: 'user-1',
  } as unknown as AuthenticatedRequest;
  return {
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext,
    reflector: {
      getAllAndOverride: jest.fn().mockReturnValue(requiredRoles),
    } as unknown as jest.Mocked<Reflector>,
  };
}

describe('RolesGuard', () => {
  let userRepository: jest.Mocked<UserRepositoryPort>;

  beforeEach(() => {
    userRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      list: jest.fn(),
    };
  });

  it('allows access when the handler declares no required roles', async () => {
    const { context, reflector } = buildContext(undefined);
    const guard = new RolesGuard(reflector, userRepository);

    expect(await guard.canActivate(context)).toBe(true);
    expect(userRepository.findById).not.toHaveBeenCalled();
  });

  it('allows access when the user has one of the required roles', async () => {
    const { context, reflector } = buildContext(['admin', 'publisher']);
    userRepository.findById.mockResolvedValue(buildUser({ role: 'admin' }));
    const guard = new RolesGuard(reflector, userRepository);

    expect(await guard.canActivate(context)).toBe(true);
  });

  it('throws Forbidden when the user is active but lacks the required role', async () => {
    const { context, reflector } = buildContext(['admin']);
    userRepository.findById.mockResolvedValue(buildUser({ role: 'editor' }));
    const guard = new RolesGuard(reflector, userRepository);

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws Unauthorized when the user no longer exists', async () => {
    const { context, reflector } = buildContext(['admin']);
    userRepository.findById.mockResolvedValue(null);
    const guard = new RolesGuard(reflector, userRepository);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws Unauthorized for a deactivated user, even with the right role — session cookie stops working on the very next guarded request', async () => {
    const { context, reflector } = buildContext(['admin']);
    const user = buildUser({ role: 'admin', isActive: false });
    userRepository.findById.mockResolvedValue(user);
    const guard = new RolesGuard(reflector, userRepository);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
