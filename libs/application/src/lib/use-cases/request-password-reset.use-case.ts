import { buildPasswordResetEmail } from '../emails/password-reset-email.template.js';
import type {
  EmailPort,
  UserRepositoryPort,
  VerificationTokenPort,
} from '@brisk/ports';

const PASSWORD_RESET_TTL_MS = 1000 * 60 * 60; // 1h

export interface RequestPasswordResetDeps {
  userRepository: UserRepositoryPort;
  verificationTokenPort: VerificationTokenPort;
  emailPort: EmailPort;
}

export interface RequestPasswordResetInput {
  tenantId: string;
  email: string;
  /** e.g. EDITOR_APP_URL — the use-case appends `/reset-password?resetToken=<token>`. */
  resetUrlBase: string;
}

/**
 * Always resolves, whether or not the email matches a real user — same
 * anti-enumeration principle as loginUser's InvalidCredentialsError: the
 * caller must never be able to tell "no account with that email" apart
 * from "email sent".
 */
export async function requestPasswordReset(
  deps: RequestPasswordResetDeps,
  input: RequestPasswordResetInput,
): Promise<void> {
  const user = await deps.userRepository.findByEmail(
    input.tenantId,
    input.email,
  );
  if (!user) {
    return;
  }

  const resetToken = await deps.verificationTokenPort.createToken(
    user.id,
    user.tenantId,
    'password-reset',
    PASSWORD_RESET_TTL_MS,
  );
  const resetUrlBase = input.resetUrlBase.replace(/\/$/, '');
  const resetUrl = `${resetUrlBase}/reset-password?resetToken=${resetToken.token}`;

  await deps.emailPort.sendEmail({
    to: user.email,
    ...buildPasswordResetEmail(resetUrl),
  });
}
