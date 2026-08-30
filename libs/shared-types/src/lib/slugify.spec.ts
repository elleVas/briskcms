import { describe, expect, it } from 'vitest';
import { slugify } from './slugify';

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('Chi Siamo')).toBe('chi-siamo');
  });

  it('strips accents', () => {
    expect(slugify('Perché')).toBe('perche');
  });

  it('strips punctuation and collapses runs of separators into one hyphen', () => {
    expect(slugify('  Café & Bar!!  ')).toBe('cafe-bar');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('-già pronto-')).toBe('gia-pronto');
  });
});
