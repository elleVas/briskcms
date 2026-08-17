import { describe, expect, it } from 'vitest';
import {
  InvalidCredentialsError,
  InvalidOrExpiredTokenError,
  PageNotFoundError,
  PageVersionNotFoundError,
} from './errors.js';

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

describe('InvalidCredentialsError', () => {
  it('carries a generic message that never reveals which part was wrong', () => {
    const error = new InvalidCredentialsError();

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('InvalidCredentialsError');
    expect(error.message).toBe('Invalid email or password');
  });
});

describe('InvalidOrExpiredTokenError', () => {
  it('is a real Error with a generic message', () => {
    const error = new InvalidOrExpiredTokenError();

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('InvalidOrExpiredTokenError');
    expect(error.message).toBe('Invalid or expired token');
  });
});
