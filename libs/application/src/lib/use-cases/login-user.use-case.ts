import {
  InvalidCredentialsError,
  UserNotActiveError,
} from '@brisk/domain-core';
import type { AuthPort, Session, UserRepositoryPort } from '@brisk/ports';

export interface LoginUserDeps {
  userRepository: UserRepositoryPort;
  authPort: AuthPort;
}

export interface LoginUserInput {
  tenantId: string;
  email: string;
  password: string;
}

export async function loginUser(
  deps: LoginUserDeps,
  input: LoginUserInput,
): Promise<Session> {
  const user = await deps.userRepository.findByEmail(
    input.tenantId,
    input.email,
  );
  if (!user) {
    throw new InvalidCredentialsError();
  }

  const passwordMatches = await deps.authPort.verifyPassword(
    input.password,
    user.passwordHash,
  );
  if (!passwordMatches) {
    throw new InvalidCredentialsError();
  }

  // Checked after the password, not before: a deactivated account should
  // never be distinguishable from a wrong password to someone who doesn't
  // already know the correct one (same anti-enumeration reasoning as
  // InvalidCredentialsError above). See RolesGuard for the complementary
  // half — it re-checks isActive on every already-authenticated request,
  // this closes the gap for controllers with no @Roles() declared at all
  // (security review 2026-08-25).
  if (!user.isActive) {
    throw new UserNotActiveError(user.id);
  }

  return deps.authPort.createSession(user.id, user.tenantId);
}
