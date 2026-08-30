import { describe, expect, it } from 'vitest';
import { Translator } from './i18n';

describe('Translator', () => {
  it('returns the Italian string for a known key and locale', () => {
    expect(new Translator('it').t('form.submit')).toBe('Invia');
  });

  it('returns the English string for a known key and locale', () => {
    expect(new Translator('en').t('form.submit')).toBe('Submit');
  });

  it('substitutes {var} placeholders', () => {
    expect(
      new Translator('it').t('form.stepIndicator', { current: 2, total: 4 }),
    ).toBe('Passo 2 di 4');
  });

  it('falls back to the base language subtag (en-US -> en)', () => {
    expect(new Translator('en-US').t('form.submit')).toBe('Submit');
  });

  it('falls back to Italian for a locale with no dictionary of its own', () => {
    expect(new Translator('fr').t('form.submit')).toBe('Invia');
  });
});
