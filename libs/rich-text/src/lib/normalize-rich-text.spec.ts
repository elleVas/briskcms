import { describe, expect, it } from 'vitest';
import { normalizeRichText } from './normalize-rich-text';

describe('normalizeRichText', () => {
  describe('a plain string written before rich text existed', () => {
    it('becomes a paragraph', () => {
      expect(normalizeRichText('Ciao mondo')).toBe('<p>Ciao mondo</p>');
    });

    // The reason this function exists on the READ path and not only in a
    // migration script: unescaped, `set:html` eats this.
    it('escapes what would otherwise be read as markup', () => {
      expect(normalizeRichText('Rossi & Figli')).toBe(
        '<p>Rossi &amp; Figli</p>',
      );
      expect(normalizeRichText('Costa < 10 euro')).toBe(
        '<p>Costa &lt; 10 euro</p>',
      );
    });

    it('makes a blank line a new paragraph', () => {
      expect(normalizeRichText('Primo\n\nSecondo')).toBe(
        '<p>Primo</p><p>Secondo</p>',
      );
    });

    it('makes a single newline a line break, not a lost one', () => {
      expect(normalizeRichText('Via Roma 1\nMilano')).toBe(
        '<p>Via Roma 1<br />Milano</p>',
      );
    });
  });

  describe('a value that is already rich text', () => {
    it('is left as it is', () => {
      const html = '<p>ciao <strong>mondo</strong></p>';
      expect(normalizeRichText(html)).toBe(html);
    });

    it('is still sanitised', () => {
      expect(normalizeRichText('<p>ok</p><script>steal()</script>')).toBe(
        '<p>ok</p>',
      );
    });

    it('keeps an internal page reference for render to resolve', () => {
      expect(
        normalizeRichText('<p><a href="brisk://page/9f3a">x</a></p>'),
      ).toContain('brisk://page/9f3a');
    });
  });

  // Load-bearing: the same function runs on write, on read AND in the
  // migration script. If a second pass changed anything, a value would
  // drift a little further every time it was saved.
  it('is idempotent', () => {
    for (const input of [
      'Rossi & Figli',
      'Primo\n\nSecondo',
      '<p>ciao <em>mondo</em></p>',
      'Via Roma 1\nMilano',
      '',
    ]) {
      const once = normalizeRichText(input);
      expect(normalizeRichText(once), input).toBe(once);
    }
  });

  it('leaves an empty value empty, so "is this filled in" keeps working', () => {
    expect(normalizeRichText('')).toBe('');
    expect(normalizeRichText('   ')).toBe('');
  });
});
