export class PageGroupNotFoundError extends Error {
  constructor(pageGroupId: string) {
    super(`Page group not found: ${pageGroupId}`);
    this.name = 'PageGroupNotFoundError';
  }
}

export class PageGroupVersionNotFoundError extends Error {
  constructor(versionId: string) {
    super(`Page group version not found: ${versionId}`);
    this.name = 'PageGroupVersionNotFoundError';
  }
}

/** reorderSiblingPageGroups was given a group id list that isn't an exact permutation of the actual current sibling group — missing, extra, or foreign ids. */
export class PageGroupReorderMismatchError extends Error {
  constructor() {
    super(
      'The provided page group order does not match the actual sibling group',
    );
    this.name = 'PageGroupReorderMismatchError';
  }
}

export class PageTranslationNotFoundError extends Error {
  constructor(pageTranslationId: string) {
    super(`Page translation not found: ${pageTranslationId}`);
    this.name = 'PageTranslationNotFoundError';
  }
}

/** A page group can only have one translation per locale — see the (tenant, pageGroupId, locale) unique constraint in schema.ts. */
export class PageTranslationLocaleAlreadyExistsError extends Error {
  constructor(locale: string) {
    super(`This page group already has a translation in "${locale}"`);
    this.name = 'PageTranslationLocaleAlreadyExistsError';
  }
}

/** Raised when a use-case tries to write a structural mutation (block insert/remove/reorder) meant for the shared PageGroup.content onto a translation that has isDiverged — those go through saveDivergedContent instead. */
export class PageTranslationDivergedError extends Error {
  constructor(pageTranslationId: string) {
    super(
      `Page translation ${pageTranslationId} is diverged from the shared structure`,
    );
    this.name = 'PageTranslationDivergedError';
  }
}

/** The mirror image of PageTranslationDivergedError — raised when a use-case tries to write to a translation's own `divergedContent` (saveDivergedContent) while it is still linked to the shared structure. */
export class PageTranslationNotDivergedError extends Error {
  constructor(pageTranslationId: string) {
    super(
      `Page translation ${pageTranslationId} has not diverged from the shared structure`,
    );
    this.name = 'PageTranslationNotDivergedError';
  }
}

/** A page's (tenant, site, locale, parentId, slug) must be unique, sibling-scoped (WP-style) — see the composite unique constraint + the page_translations_root_slug_unique partial index (root-level pages only) in schema.ts. */
export class PageSlugAlreadyExistsError extends Error {
  constructor(slug: string) {
    super(`A page with slug "${slug}" already exists under this parent`);
    this.name = 'PageSlugAlreadyExistsError';
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
 * Security review 2026-08-24, "third pass": an already-accepted invite
 * cannot be "resent" — the user already has a real password, and sending
 * them the invite link again would let them reset that password without
 * going through the "forgotten password" flow (which verifies identity
 * differently: it invalidates every existing session, and this does not).
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

/** Raised by updateSiteThemePackage when `themeName` isn't one of this
 * deployment's bundled themes (ThemeCatalogPort, docs/adr/0042) — a stale
 * dropdown option, or a direct API call for a theme this image never shipped. */
export class InvalidThemeNameError extends Error {
  constructor(themeName: string) {
    super(`Theme not available in this deployment: ${themeName}`);
    this.name = 'InvalidThemeNameError';
  }
}
