import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  type HttpException,
  type Type,
} from '@nestjs/common';
import {
  FormNotFoundError,
  InvalidCaptchaError,
  InvalidFormSubmissionError,
  MediaNotFoundError,
  PageHierarchyCycleError,
  PageHierarchyLocaleMismatchError,
  PageNotFoundError,
  PageReorderMismatchError,
  PageSlugAlreadyExistsError,
  PageTranslationAlreadyExistsError,
  PageVersionNotFoundError,
  SiteLayoutSectionNotFoundError,
  SiteLayoutSectionVersionNotFoundError,
  SiteNotFoundError,
  UnsupportedAttachmentTypeError,
  UnsupportedMediaTypeError,
  UserAlreadyActiveError,
  UserEmailAlreadyExistsError,
  UserNotFoundError,
} from '@brisk/domain-core';

type DomainErrorFactory = (message: string) => HttpException;

/**
 * Tabella unica al posto dei 7 `handleDomainErrors` privati duplicati (uno
 * per controller: pages/forms/public-forms/site-layout-sections/sites/
 * users/media, ognuno con lo stesso try/catch e la propria whitelist) —
 * security review 2026-08-24, punto 17. Consumata da HttpExceptionFilter,
 * mai dai controller stessi: un domain error ora si propaga senza essere
 * intercettato lì, il filtro globale lo mappa una volta sola.
 *
 * auth.controller.ts NON è qui — i suoi 3 errori (InvalidCredentialsError,
 * UserNotActiveError, InvalidOrExpiredTokenError) hanno logica anti-
 * enumerazione (stesso messaggio generico per credenziali sbagliate E
 * account disattivato, vedi loginUser) che una mappa generica romperebbe.
 * Restano gestiti lì, invariati.
 */
const DOMAIN_ERROR_MAPPINGS: Array<[Type<Error>, DomainErrorFactory]> = [
  [PageNotFoundError, (m) => new NotFoundException(m)],
  [PageVersionNotFoundError, (m) => new NotFoundException(m)],
  [FormNotFoundError, (m) => new NotFoundException(m)],
  [SiteLayoutSectionNotFoundError, (m) => new NotFoundException(m)],
  [SiteLayoutSectionVersionNotFoundError, (m) => new NotFoundException(m)],
  [SiteNotFoundError, (m) => new NotFoundException(m)],
  [UserNotFoundError, (m) => new NotFoundException(m)],
  [MediaNotFoundError, (m) => new NotFoundException(m)],
  [PageSlugAlreadyExistsError, (m) => new ConflictException(m)],
  [PageTranslationAlreadyExistsError, (m) => new ConflictException(m)],
  [UserEmailAlreadyExistsError, (m) => new ConflictException(m)],
  [UserAlreadyActiveError, (m) => new ConflictException(m)],
  [PageHierarchyCycleError, (m) => new BadRequestException(m)],
  [PageHierarchyLocaleMismatchError, (m) => new BadRequestException(m)],
  [PageReorderMismatchError, (m) => new BadRequestException(m)],
  [InvalidFormSubmissionError, (m) => new BadRequestException(m)],
  [InvalidCaptchaError, (m) => new BadRequestException(m)],
  [UnsupportedAttachmentTypeError, (m) => new BadRequestException(m)],
  [UnsupportedMediaTypeError, (m) => new BadRequestException(m)],
];

/** `null` quando `error` non è uno degli errori di dominio noti qui — il chiamante (HttpExceptionFilter) lo tratta allora come un 500 grezzo. */
export function mapDomainErrorToHttpException(
  error: unknown,
): HttpException | null {
  if (!(error instanceof Error)) {
    return null;
  }
  for (const [ErrorClass, factory] of DOMAIN_ERROR_MAPPINGS) {
    if (error instanceof ErrorClass) {
      return factory(error.message);
    }
  }
  return null;
}
