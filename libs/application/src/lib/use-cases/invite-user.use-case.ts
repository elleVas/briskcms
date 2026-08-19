import { randomUUID } from 'node:crypto';
import { User, UserEmailAlreadyExistsError } from '@brisk/domain-core';
import type { UserRole } from '@brisk/domain-core';
import type {
  AuthPort,
  EmailPort,
  UserRepositoryPort,
  VerificationTokenPort,
} from '@brisk/ports';
import { buildInviteEmail } from '../emails/invite-email.template.js';

// Longer than password-reset's 1h: accepting an invite isn't a
// time-sensitive security action, and an admin realistically expects a
// new collaborator to get to it within a normal work week, not an hour.
const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export interface InviteUserDeps {
  userRepository: UserRepositoryPort;
  authPort: AuthPort;
  verificationTokenPort: VerificationTokenPort;
  emailPort: EmailPort;
}

export interface InviteUserInput {
  tenantId: string;
  email: string;
  displayName: string;
  role: UserRole;
  /** e.g. EDITOR_APP_URL — the use-case appends `/accept-invite?inviteToken=<token>`. */
  inviteUrlBase: string;
}

/**
 * Creates the User row immediately, inactive (`isActive: false`) with an
 * unguessable random password hash — nobody can sign in until
 * `acceptInvite` sets a real password and reactivates the account. This
 * is what lets the invite token reuse the exact same
 * `VerificationTokenPort` mechanic as password-reset/email-verification
 * (`userId` must reference an existing row), instead of inventing a
 * separate "pending invite, no user yet" concept.
 */
export async function inviteUser(
  deps: InviteUserDeps,
  input: InviteUserInput,
): Promise<User> {
  const existing = await deps.userRepository.findByEmail(
    input.tenantId,
    input.email,
  );
  if (existing) {
    throw new UserEmailAlreadyExistsError(input.email);
  }

  const unguessablePassword = randomUUID() + randomUUID();
  const passwordHash = await deps.authPort.hashPassword(unguessablePassword);

  const user = User.create({
    id: randomUUID(),
    tenantId: input.tenantId,
    email: input.email,
    displayName: input.displayName,
    passwordHash,
    role: input.role,
    isActive: false,
  });
  await deps.userRepository.save(user);

  const inviteToken = await deps.verificationTokenPort.createToken(
    user.id,
    user.tenantId,
    'user-invite',
    INVITE_TTL_MS,
  );
  const inviteUrlBase = input.inviteUrlBase.replace(/\/$/, '');
  const inviteUrl = `${inviteUrlBase}/accept-invite?inviteToken=${inviteToken.token}`;

  await deps.emailPort.sendEmail({
    to: user.email,
    ...buildInviteEmail(inviteUrl),
  });

  return user;
}
