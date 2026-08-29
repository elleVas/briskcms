import { describe, expect, it } from 'vitest';
import { isRtlLocale, localeDirection } from './locale-direction.js';

describe('isRtlLocale', () => {
  it('recognizes bare RTL language codes', () => {
    expect(isRtlLocale('ar')).toBe(true);
    expect(isRtlLocale('he')).toBe(true);
    expect(isRtlLocale('fa')).toBe(true);
    expect(isRtlLocale('ur')).toBe(true);
  });

  it('recognizes RTL codes with a region subtag', () => {
    expect(isRtlLocale('ar-SA')).toBe(true);
    expect(isRtlLocale('he-IL')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isRtlLocale('AR')).toBe(true);
  });

  it('returns false for LTR locales', () => {
    expect(isRtlLocale('it')).toBe(false);
    expect(isRtlLocale('en')).toBe(false);
    expect(isRtlLocale('en-US')).toBe(false);
  });
});

describe('localeDirection', () => {
  it('returns rtl for an RTL locale', () => {
    expect(localeDirection('ar')).toBe('rtl');
  });

  it('returns ltr for anything else', () => {
    expect(localeDirection('it')).toBe('ltr');
  });
});
