import {
  BadRequestException,
  PayloadTooLargeException,
  ConflictException,
  ForbiddenException,
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
  PageSlugCollidesWithTermError,
  PageTranslationDivergedError,
  PageTranslationLocaleAlreadyExistsError,
  PageTranslationNotDivergedError,
  PageTranslationNotFoundError,
  ReusableSectionNameAlreadyExistsError,
  ReusableSectionNotFoundError,
  ReusableSectionVersionNotFoundError,
  SiteLayoutSectionNotFoundError,
  SiteLayoutSectionVersionNotFoundError,
  SiteNotFoundError,
  TaxonomyNotFoundError,
  TaxonomyNotHierarchicalError,
  TaxonomyPrefixAlreadyExistsError,
  TermAddressCollidesWithPageError,
  TermAddressTakenError,
  TermCycleError,
  TermNotFoundError,
  UnsupportedAttachmentTypeError,
  MediaTooLargeError,
  UnsupportedMediaTypeError,
  UserAlreadyActiveError,
  UserEmailAlreadyExistsError,
  CannotChangeYourOwnAccessError,
  CollectionNotFoundError,
  LastActiveAdminError,
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
  [ReusableSectionNotFoundError, (m) => new NotFoundException(m)],
  [ReusableSectionVersionNotFoundError, (m) => new NotFoundException(m)],
  [SiteLayoutSectionNotFoundError, (m) => new NotFoundException(m)],
  [SiteLayoutSectionVersionNotFoundError, (m) => new NotFoundException(m)],
  [SiteNotFoundError, (m) => new NotFoundException(m)],
  [UserNotFoundError, (m) => new NotFoundException(m)],
  [CollectionNotFoundError, (m) => new NotFoundException(m)],
  [MediaNotFoundError, (m) => new NotFoundException(m)],
  [PageSlugAlreadyExistsError, (m) => new ConflictException(m)],
  [ReusableSectionNameAlreadyExistsError, (m) => new ConflictException(m)],
  [PageTranslationLocaleAlreadyExistsError, (m) => new ConflictException(m)],
  [PageTranslationDivergedError, (m) => new ConflictException(m)],
  [PageTranslationNotDivergedError, (m) => new ConflictException(m)],
  [UserEmailAlreadyExistsError, (m) => new ConflictException(m)],
  [UserAlreadyActiveError, (m) => new ConflictException(m)],
  // 409, like the two above it: nothing about the caller is wrong, the
  // tenant is simply in a state where this request would destroy access
  // to itself.
  [LastActiveAdminError, (m) => new ConflictException(m)],
  // 403, not 409: here the caller IS the problem — the request is
  // refused because of who is making it, not because of the tenant's
  // state.
  [CannotChangeYourOwnAccessError, (m) => new ForbiddenException(m)],
  [PageGroupReorderMismatchError, (m) => new BadRequestException(m)],
  [InvalidFormSubmissionError, (m) => new BadRequestException(m)],
  [InvalidCaptchaError, (m) => new BadRequestException(m)],
  [UnsupportedAttachmentTypeError, (m) => new BadRequestException(m)],
  [UnsupportedMediaTypeError, (m) => new BadRequestException(m)],
  // 413, not 400: the request was well formed, it was too big — and the
  // status is what a client can act on without parsing the message.
  [MediaTooLargeError, (m) => new PayloadTooLargeException(m)],
  [InvalidThemeNameError, (m) => new BadRequestException(m)],
  [TaxonomyNotFoundError, (m) => new NotFoundException(m)],
  [TermNotFoundError, (m) => new NotFoundException(m)],
  // 409 for all four address conflicts: the request is well formed and
  // the caller can act on it — pick another name — which is exactly what
  // a conflict means. The message names what is in the way, term or
  // page, because "that address is taken" without saying by what sends
  // somebody hunting through the wrong list (docs/adr/0064).
  [TaxonomyPrefixAlreadyExistsError, (m) => new ConflictException(m)],
  [TermAddressTakenError, (m) => new ConflictException(m)],
  [TermAddressCollidesWithPageError, (m) => new ConflictException(m)],
  [PageSlugCollidesWithTermError, (m) => new ConflictException(m)],
  // 400, not 409: nothing is occupied, the shape of the request is
  // simply impossible — a term cannot descend from itself, and a flat
  // dimension has no parents to offer.
  [TermCycleError, (m) => new BadRequestException(m)],
  [TaxonomyNotHierarchicalError, (m) => new BadRequestException(m)],
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
