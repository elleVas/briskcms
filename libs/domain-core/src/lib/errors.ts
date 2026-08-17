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
