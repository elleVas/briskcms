import { assertNotTheLastAdmin } from './assert-not-the-last-admin';
import { assertNotYourself } from './assert-not-yourself';
import { UserNotFoundError } from '@brisk/domain-core';
import type { User, UserRole } from '@brisk/domain-core';
import type { UserRepositoryPort } from '@brisk/ports';

export interface UpdateUserRoleDeps {
  userRepository: UserRepositoryPort;
}

export interface UpdateUserRoleInput {
  tenantId: string;
  userId: string;
  role: UserRole;
  /** Who is asking — nobody may change their own role, see CannotChangeYourOwnAccessError. */
  actorUserId: string | null;
}

export async function updateUserRole(
  deps: UpdateUserRoleDeps,
  input: UpdateUserRoleInput,
): Promise<User> {
  const user = await deps.userRepository.findById(input.tenantId, input.userId);
  if (!user) {
    throw new UserNotFoundError(input.userId);
  }

  if (input.role !== user.role) {
    assertNotYourself(input.actorUserId, user);
    await assertNotTheLastAdmin(deps.userRepository, user);
  }
  user.changeRole(input.role);
  await deps.userRepository.save(user);

  return user;
}
