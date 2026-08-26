export class PageNotFoundError extends Error {
  constructor(pageId: string) {
    super(`Page not found: ${pageId}`);
    this.name = 'PageNotFoundError';
  }
}

export class PageVersionNotFoundError extends Error {
  constructor(versionId: string) {
    super(`Page version not found: ${versionId}`);
    this.name = 'PageVersionNotFoundError';
  }
}

/** A page's (tenant, site, locale, slug) must be unique — see pages_tenant_site_idx sibling constraint in schema.ts. */
export class PageSlugAlreadyExistsError extends Error {
  constructor(slug: string) {
    super(`A page with slug "${slug}" already exists for this site`);
    this.name = 'PageSlugAlreadyExistsError';
  }
}

/** A page group (Fase 5b) can only have one page per locale — see the (tenant, site, group, locale) unique constraint in schema.ts. */
export class PageTranslationAlreadyExistsError extends Error {
  constructor(locale: string) {
    super(`This page already has a translation in "${locale}"`);
    this.name = 'PageTranslationAlreadyExistsError';
  }
}

/** The proposed parent is the page itself or one of its own descendants — would create a cycle in the page hierarchy. */
export class PageHierarchyCycleError extends Error {
  constructor(pageId: string) {
    super(`Setting this parent would create a cycle for page ${pageId}`);
    this.name = 'PageHierarchyCycleError';
  }
}

/** A page's parent must live in the same site and locale — no cross-site/cross-language nesting. */
export class PageHierarchyLocaleMismatchError extends Error {
  constructor(pageId: string, parentId: string) {
    super(
      `Page ${pageId} and proposed parent ${parentId} must share the same site and locale`,
    );
    this.name = 'PageHierarchyLocaleMismatchError';
  }
}

/**
 * Deliberately generic: never reveals whether the email exists or the
 * password was wrong (prevents user enumeration via the login endpoint).
 */
export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidCredentialsError';
  }
}

/** Covers both an unknown token and one that has expired — same handling either way. */
export class InvalidOrExpiredTokenError extends Error {
  constructor() {
    super('Invalid or expired token');
    this.name = 'InvalidOrExpiredTokenError';
  }
}

export class SiteNotFoundError extends Error {
  constructor(siteId: string) {
    super(`Site not found: ${siteId}`);
    this.name = 'SiteNotFoundError';
  }
}

export class SiteLayoutSectionNotFoundError extends Error {
  constructor(id: string) {
    super(`Site layout section not found: ${id}`);
    this.name = 'SiteLayoutSectionNotFoundError';
  }
}

export class SiteLayoutSectionVersionNotFoundError extends Error {
  constructor(id: string) {
    super(`Site layout section version not found: ${id}`);
    this.name = 'SiteLayoutSectionVersionNotFoundError';
  }
}

export class FormNotFoundError extends Error {
  constructor(formId: string) {
    super(`Form not found: ${formId}`);
    this.name = 'FormNotFoundError';
  }
}

/** A submission whose payload doesn't match the form's own field
 * definitions (missing required field, wrong type) — never a 500, the
 * public submission endpoint maps this to a 400. */
export class InvalidFormSubmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidFormSubmissionError';
  }
}

/** A failed/expired/missing Turnstile token — unlike the honeypot check
 * (silently accepted so a bot can't tell it was rejected), this is a real
 * visitor-facing error: the public submission endpoint maps it to a 400 so
 * the visitor sees "please retry" instead of a fake success. */
export class InvalidCaptchaError extends Error {
  constructor() {
    super('Invalid or missing CAPTCHA token');
    this.name = 'InvalidCaptchaError';
  }
}

export class UserNotFoundError extends Error {
  constructor(userId: string) {
    super(`User not found: ${userId}`);
    this.name = 'UserNotFoundError';
  }
}

/** A tenant's (tenantId, email) must be unique — see the unique constraint in schema.ts. */
export class UserEmailAlreadyExistsError extends Error {
  constructor(email: string) {
    super(`A user with email "${email}" already exists`);
    this.name = 'UserEmailAlreadyExistsError';
  }
}

/**
 * Security review 2026-08-24, "terzo giro": un invito già accettato non
 * può essere "re-inviato" — l'utente ha già una password reale, mandargli
 * di nuovo il link di invito lo lascerebbe reimpostare la password senza
 * passare dal flusso "password dimenticata" (che verifica l'identità
 * diversamente: invalida tutte le sessioni esistenti, questo no).
 */
export class UserAlreadyActiveError extends Error {
  constructor(userId: string) {
    super(`User already active, cannot resend invite: ${userId}`);
    this.name = 'UserAlreadyActiveError';
  }
}

export class MediaNotFoundError extends Error {
  constructor(mediaId: string) {
    super(`Media not found: ${mediaId}`);
    this.name = 'MediaNotFoundError';
  }
}

/** MediaStoragePort adapters process every upload through sharp (resize +
 * WebP conversion, see ADR-0013) — not a generic file store, images only. */
export class UnsupportedMediaTypeError extends Error {
  constructor(mimeType: string) {
    super(`Unsupported media type: ${mimeType}`);
    this.name = 'UnsupportedMediaTypeError';
  }
}

/** Raised by sniffAttachmentType when the real content of a public form
 * attachment doesn't match anything on the allowlist — see
 * attachment-type-sniffer.ts for why this exists (security review
 * 2026-08-25: unauthenticated upload, client-declared extension/MIME
 * can't be trusted). */
export class UnsupportedAttachmentTypeError extends Error {
  constructor(declaredMimeType: string) {
    super(`Unsupported attachment type: ${declaredMimeType}`);
    this.name = 'UnsupportedAttachmentTypeError';
  }
}

/** Raised by loginUser when the account exists and the password is
 * correct but the account has been deactivated. Deliberately a distinct
 * error from InvalidCredentialsError (which is generic on purpose to
 * avoid user enumeration) — callers that want to preserve that generic
 * response can still catch both the same way, but the distinct type lets
 * anything that legitimately needs to tell them apart (e.g. logging) do
 * so. */
export class UserNotActiveError extends Error {
  constructor(userId: string) {
    super(`User is not active: ${userId}`);
    this.name = 'UserNotActiveError';
  }
}
