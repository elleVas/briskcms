import { createHash, randomBytes } from 'node:crypto';

/**
 * Shared by session-auth-adapter (sessions) and verification-token-adapter
 * (email verification / password reset) — same mechanic, two consumers,
 * see docs/adr/0011-email-verification-password-reset.md.
 */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * SHA-256, not argon2: the token is already high-entropy and random, so
 * there's no dictionary to defend against and no reason to pay argon2's
 * deliberate slowness on every lookup. If the DB leaks, the hashes alone
 * don't yield usable tokens.
 */
export function hashOpaqueToken(token: string): string {
  // codeql[js/insufficient-password-hash]: not a password — CodeQL's taint
  // tracking flags this because callers are named createToken/createSession,
  // but the input is a generateOpaqueToken() output: 256 bits of
  // node:crypto randomness, not a low-entropy user-chosen secret. There is
  // no dictionary/rainbow-table attack to defend against here, so a slow
  // hash (argon2/bcrypt) would only add latency with no security benefit.
  return createHash('sha256').update(token).digest('hex');
}
