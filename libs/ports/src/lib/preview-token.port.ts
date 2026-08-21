import type { PreviewContentType } from '@brisk/domain-core';

export interface PreviewToken {
  token: string;
  tenantId: string;
  contentType: PreviewContentType;
  contentId: string;
  expiresAt: Date;
}

/**
 * Same opaque-token mechanic as AuthPort's sessions (@brisk/opaque-token),
 * but non-consumante: una sessione di preview ricarica l'iframe più volte,
 * quindi validare un token non lo invalida — a differenza di
 * VerificationTokenPort.consumeToken (single-use). Vedi il piano
 * dell'editor visuale, Giorno 1.
 */
export interface PreviewTokenPort {
  /** ttlMs è una decisione di policy del chiamante (application layer), l'adapter si limita ad applicarla. */
  createToken(
    tenantId: string,
    contentType: PreviewContentType,
    contentId: string,
    ttlMs: number,
  ): Promise<PreviewToken>;

  /** null se il token non esiste, è scaduto, o non corrisponde a (contentType, contentId) richiesti. */
  validateToken(
    token: string,
    contentType: PreviewContentType,
    contentId: string,
  ): Promise<PreviewToken | null>;
}
