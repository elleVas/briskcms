import { describe, expect, it } from 'vitest';
import {
  FormNotFoundError,
  InvalidCredentialsError,
  InvalidFormSubmissionError,
  InvalidOrExpiredTokenError,
  PageGroupNotFoundError,
  PageGroupReorderMismatchError,
  PageGroupVersionNotFoundError,
  PageTranslationDivergedError,
  PageTranslationLocaleAlreadyExistsError,
  PageTranslationNotDivergedError,
  PageTranslationNotFoundError,
  SiteLayoutSectionNotFoundError,
  SiteLayoutSectionVersionNotFoundError,
  SiteNotFoundError,
} from './errors';

describe('PageGroupVersionNotFoundError', () => {
  it('carries the missing version id in its message and is a real Error', () => {
    const error = new PageGroupVersionNotFoundError('version-1');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PageGroupVersionNotFoundError');
    expect(error.message).toBe('Page group version not found: version-1');
  });
});

describe('PageGroupReorderMismatchError', () => {
  it('is a real Error with a fixed message', () => {
    const error = new PageGroupReorderMismatchError();

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PageGroupReorderMismatchError');
    expect(error.message).toBe(
      'The provided page group order does not match the actual sibling group',
    );
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

describe('SiteLayoutSectionNotFoundError', () => {
  it('carries the missing section id in its message and is a real Error', () => {
    const error = new SiteLayoutSectionNotFoundError('section-1');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('SiteLayoutSectionNotFoundError');
    expect(error.message).toBe('Site layout section not found: section-1');
  });
});

describe('PageGroupNotFoundError', () => {
  it('carries the missing group id in its message and is a real Error', () => {
    const error = new PageGroupNotFoundError('group-1');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PageGroupNotFoundError');
    expect(error.message).toBe('Page group not found: group-1');
  });
});

describe('PageTranslationNotFoundError', () => {
  it('carries the missing translation id in its message and is a real Error', () => {
    const error = new PageTranslationNotFoundError('translation-1');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PageTranslationNotFoundError');
    expect(error.message).toBe('Page translation not found: translation-1');
  });
});

describe('PageTranslationLocaleAlreadyExistsError', () => {
  it('carries the locale in its message and is a real Error', () => {
    const error = new PageTranslationLocaleAlreadyExistsError('en');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PageTranslationLocaleAlreadyExistsError');
    expect(error.message).toBe(
      'This page group already has a translation in "en"',
    );
  });
});

describe('PageTranslationDivergedError', () => {
  it('carries the translation id in its message and is a real Error', () => {
    const error = new PageTranslationDivergedError('translation-1');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PageTranslationDivergedError');
    expect(error.message).toBe(
      'Page translation translation-1 is diverged from the shared structure',
    );
  });
});

describe('PageTranslationNotDivergedError', () => {
  it('carries the translation id in its message and is a real Error', () => {
    const error = new PageTranslationNotDivergedError('translation-1');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PageTranslationNotDivergedError');
    expect(error.message).toBe(
      'Page translation translation-1 has not diverged from the shared structure',
    );
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
