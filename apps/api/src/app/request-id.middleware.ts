import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export interface RequestWithId extends Request {
  requestId: string;
}

/**
 * Un id per richiesta, propagato nei log (HttpExceptionFilter) e nella
 * risposta (header X-Request-Id) — security review 2026-08-24, punto 14:
 * senza, correlare un errore visto da un cliente con la riga di log giusta
 * (magari in mezzo a migliaia di altre) è impossibile a posteriori. Riusa
 * un X-Request-Id già presente in entrata (proxy/load balancer davanti a
 * questo servizio), altrimenti ne genera uno nuovo.
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.headers['x-request-id'];
  const requestId =
    typeof incoming === 'string' && incoming.trim() !== ''
      ? incoming
      : randomUUID();
  (req as RequestWithId).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
