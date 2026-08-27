import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PreviewContentType } from '@brisk/domain-core';
import type { PreviewToken, PreviewTokenPort } from '@brisk/ports';

interface PreviewTokenPayload {
  tenantId: string;
  contentType: PreviewContentType;
  contentId: string;
  expiresAt: number;
}

function sign(payloadB64: string, secret: string): string {
  return createHmac('sha256', secret).update(payloadB64).digest('base64url');
}

/**
 * Stateless, non-consumante per costruzione: nessuna riga da persistere o
 * ripulire (era `content_preview_tokens`, la tabella a crescita più rapida
 * delle tre trovate dalla review 2026-08-24, senza alcun meccanismo di
 * pulizia). Il token stesso porta (tenantId, contentType, contentId,
 * expiresAt) più una firma HMAC — validare significa solo ricalcolare la
 * firma e controllare la scadenza, mai una query.
 *
 * A differenza di sessions/verification_tokens, qui non serve né la revoca
 * anticipata (un preview link vive un'ora, solo dentro la stessa sessione
 * browser dell'editor) né il single-use (il canvas ricarica l'iframe più
 * volte con lo stesso token) — le due proprietà che invece giustificano il
 * meccanismo DB-backed di quegli altri due Port.
 *
 * Nota di sicurezza: il payload è firmato ma non cifrato — tenantId/
 * contentType/contentId restano leggibili da chi ha il token (decodificando
 * il base64url), anche se non falsificabili senza il secret. Accettabile
 * qui: tenantId non è trattato come segreto altrove in questo codebase
 * (single-tenant-per-deployment, docs/adr/0010), e chi possiede il token è
 * già, per costruzione, l'iframe autorizzato a vedere esattamente quel
 * contentId.
 */
export class PreviewTokenAdapter implements PreviewTokenPort {
  constructor(private readonly secret: string) {}

  async createToken(
    tenantId: string,
    contentType: PreviewContentType,
    contentId: string,
    ttlMs: number,
  ): Promise<PreviewToken> {
    const expiresAt = new Date(Date.now() + ttlMs);
    const payload: PreviewTokenPayload = {
      tenantId,
      contentType,
      contentId,
      expiresAt: expiresAt.getTime(),
    };
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString(
      'base64url',
    );
    const token = `${payloadB64}.${sign(payloadB64, this.secret)}`;

    return { token, tenantId, contentType, contentId, expiresAt };
  }

  async validateToken(
    token: string,
    contentType: PreviewContentType,
    contentId: string,
  ): Promise<PreviewToken | null> {
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) {
      return null;
    }

    const expectedSignature = sign(payloadB64, this.secret);
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return null;
    }

    let payload: PreviewTokenPayload;
    try {
      payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    } catch {
      return null;
    }

    if (
      payload.contentType !== contentType ||
      payload.contentId !== contentId ||
      payload.expiresAt <= Date.now()
    ) {
      return null;
    }

    return {
      token,
      tenantId: payload.tenantId,
      contentType: payload.contentType,
      contentId: payload.contentId,
      expiresAt: new Date(payload.expiresAt),
    };
  }
}
