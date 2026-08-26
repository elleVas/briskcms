import {
  Catch,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { mapDomainErrorToHttpException } from './domain-error-http-mapping.js';
import type { RequestWithId } from './request-id.middleware.js';

/**
 * Filtro globale (security review 2026-08-24, punti 14+17) — due problemi
 * risolti insieme perché sono la stessa area di codice:
 * - punto 17: rimpiazza i 7 `handleDomainErrors` privati duplicati (uno per
 *   controller) con un'unica mappa (domain-error-http-mapping.ts) applicata
 *   qui, non più nei controller stessi.
 * - punto 14: logging praticamente assente — ogni errore non gestito
 *   arrivava (o non arrivava affatto) al log senza contesto. Ora ogni
 *   richiesta fallita viene loggata con il suo request-id (vedi
 *   request-id.middleware.ts), method+url e status — un crash in
 *   produzione si scopre da qui, non più solo dal cliente.
 *
 * `@Catch()` senza argomenti: cattura TUTTO, non solo HttpException — un
 * domain error che sfugge a mapDomainErrorToHttpException (o un vero bug)
 * diventa comunque un 500 loggato con lo stack, mai un crash silenzioso
 * del processo.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();

    const httpException = this.resolveHttpException(exception);
    const status = httpException.getStatus();
    const requestId = request.requestId;

    const logLine = `${request.method} ${request.originalUrl} -> ${status} [${requestId}]`;
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${logLine} ${httpException.message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else if (status >= HttpStatus.BAD_REQUEST) {
      this.logger.warn(`${logLine} ${httpException.message}`);
    }

    const body = httpException.getResponse();
    response
      .status(status)
      .json(
        typeof body === 'string'
          ? { statusCode: status, message: body, requestId }
          : { ...body, requestId },
      );
  }

  private resolveHttpException(exception: unknown): HttpException {
    if (exception instanceof HttpException) {
      return exception;
    }
    const mapped = mapDomainErrorToHttpException(exception);
    if (mapped) {
      return mapped;
    }
    return new InternalServerErrorException('Internal server error');
  }
}
