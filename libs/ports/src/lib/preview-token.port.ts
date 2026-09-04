import type { PreviewContentType } from '@brisk/domain-core';

export interface PreviewToken {
  token: string;
  tenantId: string;
  contentType: PreviewContentType;
  contentId: string;
  expiresAt: Date;
}

/**
 * The same opaque-token mechanic as AuthPort's sessions
 * (@brisk/opaque-token), but non-consuming: a preview session reloads the
 * iframe several times, so validating a token does not invalidate it —
 * unlike VerificationTokenPort.consumeToken (single-use). See the visual
 * editor plan, Day 1.
 */
export interface PreviewTokenPort {
  /** ttlMs è una decisione di policy del chiamante (application layer), l'adapter si limita ad applicarla. */
  createToken(
    tenantId: string,
    contentType: PreviewContentType,
    contentId: string,
    ttlMs: number,
  ): Promise<PreviewToken>;

  /** null when the token does not exist, has expired, or does not match the requested (contentType, contentId). */
  validateToken(
    token: string,
    contentType: PreviewContentType,
    contentId: string,
  ): Promise<PreviewToken | null>;
}
