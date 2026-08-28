import { describe, expect, it } from 'vitest';
import { t } from './i18n.js';

describe('t', () => {
  it('returns the Italian string for a known key and locale', () => {
    expect(t('it', 'form.submit')).toBe('Invia');
  });

  it('returns the English string for a known key and locale', () => {
    expect(t('en', 'form.submit')).toBe('Submit');
  });

  it('substitutes {var} placeholders', () => {
    expect(t('it', 'form.stepIndicator', { current: 2, total: 4 })).toBe(
      'Passo 2 di 4',
    );
  });

  it('falls back to the base language subtag (en-US -> en)', () => {
    expect(t('en-US', 'form.submit')).toBe('Submit');
  });

  it('falls back to Italian for a locale with no dictionary of its own', () => {
    expect(t('fr', 'form.submit')).toBe('Invia');
  });
});
