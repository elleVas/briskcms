import { InvalidCredentialsError } from '@brisk/domain-core';
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

  return deps.authPort.createSession(user.id, user.tenantId);
}
