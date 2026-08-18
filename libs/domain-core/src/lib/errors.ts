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
