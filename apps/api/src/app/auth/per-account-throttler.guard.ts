import {
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ThrottlerException, ThrottlerStorage } from '@nestjs/throttler';

const TTL_MS = 15 * 60 * 1000;
const LIMIT = 5;

/**
 * Secondo asse di rate limiting, indipendente da `ThrottlerGuard` (per-IP,
 * già applicato su login/request-password-reset) — security review
 * 2026-08-24, punto 13: con solo il limite per-IP, un attaccante da un solo
 * IP può restare sotto soglia (5/min) e mandare comunque fino a 300 email
 * di reset/ora alla stessa vittima; da più IP, illimitato. Questo chiude
 * quel buco tracciando per EMAIL invece che per IP, indipendentemente da
 * quanti indirizzi li mandano.
 *
 * Riusa `ThrottlerStorage` (lo stesso storage in-memory già iniettato da
 * `ThrottlerModule` in AuthModule) invece di registrare un secondo
 * throttler "nominato" — `ThrottlerGuard` applica lo stesso tracker (IP di
 * default) a OGNI throttler nominato che vede, quindi un secondo config
 * nominato non baserebbe comunque la chiave sull'email senza duplicare
 * anche la logica del tracker per-IP già esistente.
 */
@Injectable()
export class PerAccountThrottlerGuard implements CanActivate {
  constructor(
    @Inject(ThrottlerStorage) private readonly storage: ThrottlerStorage,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      body?: { email?: unknown };
    }>();
    const email =
      typeof req.body?.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : null;
    // Nessuna email valida da tracciare — non è compito di questo guard
    // rifiutare la richiesta (ZodValidationPipe lo farà comunque a valle),
    // si limita a non contare nulla.
    if (!email) {
      return true;
    }

    const key = `per-account:${context.getClass().name}:${context.getHandler().name}:${email}`;
    const record = await this.storage.increment(
      key,
      TTL_MS,
      LIMIT,
      0,
      'per-account',
    );
    if (record.totalHits > LIMIT) {
      throw new ThrottlerException();
    }
    return true;
  }
}
