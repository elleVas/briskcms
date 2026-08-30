import { describe, expect, it } from 'vitest';
import {
  FormNotFoundError,
  InvalidCredentialsError,
  InvalidFormSubmissionError,
  InvalidOrExpiredTokenError,
  PageHierarchyCycleError,
  PageHierarchyLocaleMismatchError,
  PageNotFoundError,
  PageTranslationAlreadyExistsError,
  PageVersionNotFoundError,
  SiteLayoutSectionNotFoundError,
  SiteLayoutSectionVersionNotFoundError,
  SiteNotFoundError,
} from './errors';

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

describe('SiteNotFoundError', () => {
  it('carries the missing site id in its message and is a real Error', () => {
    const error = new SiteNotFoundError('site-1');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('SiteNotFoundError');
    expect(error.message).toBe('Site not found: site-1');
  });
});

describe('FormNotFoundError', () => {
  it('carries the missing form id in its message and is a real Error', () => {
    const error = new FormNotFoundError('form-1');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('FormNotFoundError');
    expect(error.message).toBe('Form not found: form-1');
  });
});

describe('InvalidFormSubmissionError', () => {
  it('carries the given message and is a real Error', () => {
    const error = new InvalidFormSubmissionError(
      'Missing required field: email',
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('InvalidFormSubmissionError');
    expect(error.message).toBe('Missing required field: email');
  });
});

describe('PageTranslationAlreadyExistsError', () => {
  it('carries the locale in its message and is a real Error', () => {
    const error = new PageTranslationAlreadyExistsError('en');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PageTranslationAlreadyExistsError');
    expect(error.message).toBe('This page already has a translation in "en"');
  });
});

describe('PageHierarchyCycleError', () => {
  it('carries the page id in its message and is a real Error', () => {
    const error = new PageHierarchyCycleError('page-1');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PageHierarchyCycleError');
    expect(error.message).toBe(
      'Setting this parent would create a cycle for page page-1',
    );
  });
});

describe('PageHierarchyLocaleMismatchError', () => {
  it('carries both page ids in its message and is a real Error', () => {
    const error = new PageHierarchyLocaleMismatchError('page-1', 'page-2');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PageHierarchyLocaleMismatchError');
    expect(error.message).toBe(
      'Page page-1 and proposed parent page-2 must share the same site and locale',
    );
  });
});

describe('SiteLayoutSectionNotFoundError', () => {
  it('carries the missing section id in its message and is a real Error', () => {
    const error = new SiteLayoutSectionNotFoundError('section-1');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('SiteLayoutSectionNotFoundError');
    expect(error.message).toBe('Site layout section not found: section-1');
  });
});

describe('SiteLayoutSectionVersionNotFoundError', () => {
  it('carries the missing version id in its message and is a real Error', () => {
    const error = new SiteLayoutSectionVersionNotFoundError('version-1');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('SiteLayoutSectionVersionNotFoundError');
    expect(error.message).toBe(
      'Site layout section version not found: version-1',
    );
  });
});
