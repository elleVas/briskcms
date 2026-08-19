import { InvalidOrExpiredTokenError } from '@brisk/domain-core';
import type {
  AuthPort,
  UserRepositoryPort,
  VerificationTokenPort,
} from '@brisk/ports';

export interface AcceptInviteDeps {
  userRepository: UserRepositoryPort;
  verificationTokenPort: VerificationTokenPort;
  authPort: AuthPort;
}

export interface AcceptInviteInput {
  token: string;
  password: string;
}

/** Same "consume the token, act on the user it points at" shape as resetPassword — sets a real password and flips isActive back to true (the same transition a reactivation-after-deactivation would do). */
export async function acceptInvite(
  deps: AcceptInviteDeps,
  input: AcceptInviteInput,
): Promise<void> {
  const consumed = await deps.verificationTokenPort.consumeToken(
    input.token,
    'user-invite',
  );
  if (!consumed) {
    throw new InvalidOrExpiredTokenError();
  }

  const user = await deps.userRepository.findById(
    consumed.tenantId,
    consumed.userId,
  );
  if (!user) {
    throw new InvalidOrExpiredTokenError();
  }

  const passwordHash = await deps.authPort.hashPassword(input.password);
  user.changePasswordHash(passwordHash);
  user.reactivate();
  await deps.userRepository.save(user);
}
