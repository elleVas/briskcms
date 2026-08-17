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
