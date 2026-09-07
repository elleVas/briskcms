import { describe, expect, it } from 'vitest';
import {
  blockStyleOverrideSchema,
  normalizeResponsiveBlockStyle,
  themeTokensSchema,
  updateThemeTokensBodySchema,
} from './site-theme-tokens';

/**
 * A style override is not data the product merely stores: it is written
 * into a `<style>` on every page of the public site, with the block type
 * as the selector in front of it. Both were accepted as any non-empty
 * string, so anyone with edit rights could close our rule and open one of
 * their own — on a site they do not own.
 *
 * Demonstrated before it was fixed: `red; } body { … } .x {` produced a
 * valid full-viewport overlay, and `X { } body { display: none } .y` as a
 * block type produced exactly that rule.
 */
describe('a style value cannot escape the declaration it is written into', () => {
  it.each([
    ['closes the rule and opens another', 'red; } body { display: none } .x {'],
    ['smuggles an at-rule', 'red@import url(//evil.example)'],
    ['comments out the closing brace', 'red/* } body { x } .y { */'],
    ['escapes a semicolon', 'red\\3B } body { display:none } .x {'],
    ['carries markup', '<style>x</style>'],
  ])('refuses a value that %s', (_why, hostile) => {
    expect(
      blockStyleOverrideSchema.safeParse({ backgroundColor: hostile }).success,
    ).toBe(false);
    expect(
      blockStyleOverrideSchema.safeParse({ paddingY: hostile }).success,
    ).toBe(false);
  });

  it('refuses a value long enough to be a payload rather than a colour', () => {
    expect(
      blockStyleOverrideSchema.safeParse({ backgroundColor: 'a'.repeat(201) })
        .success,
    ).toBe(false);
  });

  // The reason this is a character rule and not a CSS grammar: a grammar
  // strict enough to be safe would also refuse what people legitimately
  // write, and then the fix would be the bug.
  it.each([
    '#fff',
    '#ff00aa80',
    'oklch(0.7 0.1 250)',
    'rgb(0 0 0 / 50%)',
    'hsl(210deg 50% 40%)',
    'var(--primary)',
    'var(--x, #fff)',
    'calc(100% - 2rem)',
    'transparent',
    'currentColor',
    '1.5rem',
    '0',
  ])('accepts %s', (value) => {
    expect(
      blockStyleOverrideSchema.safeParse({ backgroundColor: value }).success,
    ).toBe(true);
  });

  it('still accepts null, which is how "not customised" is stored', () => {
    expect(
      blockStyleOverrideSchema.safeParse({ backgroundColor: null }).success,
    ).toBe(true);
  });
});

describe('a block type cannot become a selector of its own', () => {
  it.each([
    'X { } body { display: none } .y',
    'Hero, body',
    'Hero:hover, *',
    '',
  ])('refuses %s', (hostile) => {
    expect(
      themeTokensSchema.safeParse({ blockStyles: { [hostile]: {} } }).success,
    ).toBe(false);
    expect(
      updateThemeTokensBodySchema.safeParse({ blockType: hostile, style: {} })
        .success,
    ).toBe(false);
  });

  it.each(['Hero', 'PromoBar', 'EmbedHtml', 'Column'])(
    'accepts the real type %s',
    (blockType) => {
      expect(
        themeTokensSchema.safeParse({ blockStyles: { [blockType]: {} } })
          .success,
      ).toBe(true);
    },
  );
});

describe('normalizeResponsiveBlockStyle', () => {
  it('reads a flat override written before breakpoints existed', () => {
    expect(normalizeResponsiveBlockStyle({ minHeight: '60vh' })).toEqual({
      base: { minHeight: '60vh' },
    });
  });

  it('passes a current one through unchanged', () => {
    const style = {
      base: { minHeight: '60vh' },
      mobile: { minHeight: '30vh' },
    };
    expect(normalizeResponsiveBlockStyle(style)).toEqual(style);
  });

  /**
   * The behaviour this function exists for. A row written before the
   * declaration rules of PR #144 can hold a value today's schema refuses,
   * and this runs while resolving a site: a `.parse` would answer with an
   * exception, and one bad colour saved months ago would take the whole
   * site off the air.
   */
  it('drops only the property a stored value makes unusable', () => {
    expect(
      normalizeResponsiveBlockStyle({
        base: {
          minHeight: '60vh',
          backgroundColor: 'red; } body { display: none } .x {',
        },
      }),
    ).toEqual({ base: { minHeight: '60vh' } });
  });

  it('keeps the other breakpoints when one of them holds a bad value', () => {
    expect(
      normalizeResponsiveBlockStyle({
        base: { minHeight: '60vh' },
        mobile: { minHeight: '@import url(//evil.example)' },
      }),
    ).toEqual({ base: { minHeight: '60vh' }, mobile: {} });
  });

  it.each([null, undefined, 'a string', 42, []])(
    'answers %s with an empty style rather than throwing',
    (garbage) => {
      expect(normalizeResponsiveBlockStyle(garbage)).toEqual({ base: {} });
    },
  );
});
