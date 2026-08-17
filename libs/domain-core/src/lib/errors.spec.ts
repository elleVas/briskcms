import { describe, expect, it } from 'vitest';
import { PageNotFoundError, PageVersionNotFoundError } from './errors.js';

describe('PageNotFoundError', () => {
  it('carries the missing page id in its message and is a real Error', () => {
    const error = new PageNotFoundError('page-1');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PageNotFoundError');
    expect(error.message).toBe('Page not found: page-1');
  });
});

describe('PageVersionNotFoundError', () => {
  it('carries the missing version id in its message and is a real Error', () => {
    const error = new PageVersionNotFoundError('version-1');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PageVersionNotFoundError');
    expect(error.message).toBe('Page version not found: version-1');
  });
});
