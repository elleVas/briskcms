import { LastActiveAdminError } from '@brisk/domain-core';
import type { User } from '@brisk/domain-core';
import type { UserRepositoryPort } from '@brisk/ports';

/**
 * Refuses a change that would leave a tenant with no administrator who
 * can sign in.
 *
 * Two different screens can do it — switching an admin off, and demoting
 * one to editor — and both end the same way: nobody left who can promote
 * anybody, no route back in through the product, and an UPDATE on the
 * database to recover. One guard, called by both, because a rule that
 * exists in two places is a rule that will hold in one of them.
 *
 * A user who is already inactive, or already not an admin, is not the
 * one keeping the door open, so nothing is refused there.
 */
export async function assertNotTheLastAdmin(
  userRepository: UserRepositoryPort,
  user: User,
): Promise<void> {
  if (user.role !== 'admin' || !user.isActive) return;
  const activeAdmins = await userRepository.countActiveAdmins(user.tenantId);
  if (activeAdmins <= 1) {
    throw new LastActiveAdminError();
  }
}
