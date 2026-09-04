import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  type HttpException,
  type Type,
} from '@nestjs/common';
import {
  DeploymentAlreadySetUpError,
  InvalidCaptchaError,
  InvalidFormSubmissionError,
  InvalidThemeNameError,
  MediaNotFoundError,
  PageGroupNotFoundError,
  PageGroupReorderMismatchError,
  PageGroupVersionNotFoundError,
  PageSlugAlreadyExistsError,
  PageTranslationDivergedError,
  PageTranslationLocaleAlreadyExistsError,
  PageTranslationNotDivergedError,
  PageTranslationNotFoundError,
  SiteLayoutSectionNotFoundError,
  SiteLayoutSectionVersionNotFoundError,
  SiteNotFoundError,
  UnsupportedAttachmentTypeError,
  UnsupportedMediaTypeError,
  UserAlreadyActiveError,
  UserEmailAlreadyExistsError,
  UserNotFoundError,
  FormNotFoundError,
} from '@brisk/domain-core';
import { DeploymentNotSetUpError } from './deployment-tenant.resolver';

type DomainErrorFactory = (message: string) => HttpException;

/**
 * One table in place of the 7 duplicated private `handleDomainErrors` (one
 * per controller: pages/forms/public-forms/site-layout-sections/sites/
 * users/media, each with the same try/catch and its own whitelist) —
 * security review 2026-08-24, point 17. Consumed by HttpExceptionFilter,
 * never by the controllers themselves: a domain error now propagates
 * without being intercepted there, and the global filter maps it once.
 *
 * auth.controller.ts is NOT here — its 3 errors (InvalidCredentialsError,
 * UserNotActiveError, InvalidOrExpiredTokenError) carry anti-enumeration
 * logic (the same generic message for wrong credentials AND a deactivated
 * account, see loginUser) that a generic map would break. They stay handled
 * there, unchanged.
 */
const DOMAIN_ERROR_MAPPINGS: Array<[Type<Error>, DomainErrorFactory]> = [
  // 503, not 500: a visitor reaching a deployment whose first-run wizard
  // has not been completed is a temporary, expected state with a real
  // remedy, not a fault. It is also the only entry here that is not a
  // domain error — it lives in this table anyway because the alternative
  // is a second try/catch in every public controller, which is exactly the
  // duplication this table replaced.
  [DeploymentNotSetUpError, (m) => new ServiceUnavailableException(m)],
  // 409: the wizard has already been run. Not 403 — nothing about the
  // caller is wrong, the deployment's state is simply past the point where
  // this request means anything.
  [DeploymentAlreadySetUpError, (m) => new ConflictException(m)],
  [PageGroupNotFoundError, (m) => new NotFoundException(m)],
  [PageGroupVersionNotFoundError, (m) => new NotFoundException(m)],
  [PageTranslationNotFoundError, (m) => new NotFoundException(m)],
  [FormNotFoundError, (m) => new NotFoundException(m)],
  [SiteLayoutSectionNotFoundError, (m) => new NotFoundException(m)],
  [SiteLayoutSectionVersionNotFoundError, (m) => new NotFoundException(m)],
  [SiteNotFoundError, (m) => new NotFoundException(m)],
  [UserNotFoundError, (m) => new NotFoundException(m)],
  [MediaNotFoundError, (m) => new NotFoundException(m)],
  [PageSlugAlreadyExistsError, (m) => new ConflictException(m)],
  [PageTranslationLocaleAlreadyExistsError, (m) => new ConflictException(m)],
  [PageTranslationDivergedError, (m) => new ConflictException(m)],
  [PageTranslationNotDivergedError, (m) => new ConflictException(m)],
  [UserEmailAlreadyExistsError, (m) => new ConflictException(m)],
  [UserAlreadyActiveError, (m) => new ConflictException(m)],
  [PageGroupReorderMismatchError, (m) => new BadRequestException(m)],
  [InvalidFormSubmissionError, (m) => new BadRequestException(m)],
  [InvalidCaptchaError, (m) => new BadRequestException(m)],
  [UnsupportedAttachmentTypeError, (m) => new BadRequestException(m)],
  [UnsupportedMediaTypeError, (m) => new BadRequestException(m)],
  [InvalidThemeNameError, (m) => new BadRequestException(m)],
];

/** `null` when `error` is not one of the domain errors known here — the caller (HttpExceptionFilter) then treats it as a raw 500. */
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
