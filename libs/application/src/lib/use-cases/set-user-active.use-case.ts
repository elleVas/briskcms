import { UserNotFoundError } from '@brisk/domain-core';
import type { User } from '@brisk/domain-core';
import type { AuthPort, UserRepositoryPort } from '@brisk/ports';

export interface SetUserActiveDeps {
  userRepository: UserRepositoryPort;
  authPort: AuthPort;
}

export interface SetUserActiveInput {
  tenantId: string;
  userId: string;
  isActive: boolean;
}

/**
 * A separate use-case from updateUserRole on purpose, same reasoning as
 * setPageParent/updateSiteLayoutSectionSticky: this is a structural
 * on/off switch, not a content edit.
 *
 * Deactivating also invalidates any already-open sessions (same
 * reasoning as resetPassword) — RolesGuard checking `isActive` on every
 * request would eventually catch a deactivated user anyway, but ending
 * sessions immediately means there's no window where their existing
 * cookie still works until their next guarded call happens to run.
 */
export async function setUserActive(
  deps: SetUserActiveDeps,
  input: SetUserActiveInput,
): Promise<User> {
  const user = await deps.userRepository.findById(input.tenantId, input.userId);
  if (!user) {
    throw new UserNotFoundError(input.userId);
  }

  if (input.isActive) {
    user.reactivate();
  } else {
    user.deactivate();
  }
  await deps.userRepository.save(user);

  if (!input.isActive) {
    await deps.authPort.invalidateAllSessionsForUser(user.id, user.tenantId);
  }

  return user;
}
