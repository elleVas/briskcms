import { describe, expect, it } from 'vitest';
import {
  blockTypeToClassName,
  buildBlockInstanceStyle,
  buildBlockStyleOverridesCss,
} from './block-style-overrides';

describe('blockTypeToClassName', () => {
  it('converts a simple PascalCase type', () => {
    expect(blockTypeToClassName('Button')).toBe('brisk-button');
  });

  it('converts a compound PascalCase type', () => {
    expect(blockTypeToClassName('PromoBar')).toBe('brisk-promo-bar');
    expect(blockTypeToClassName('VideoEmbed')).toBe('brisk-video-embed');
  });
});

describe('buildBlockStyleOverridesCss', () => {
  it("emits one rule per styled block type, scoped by the block's own .brisk-* class", () => {
    // NOT [data-brisk-block-type] — that wrapper only exists when
    // `editable` is true (BlockRenderer.astro), so a rule scoped there
    // would never affect what a real site visitor sees.
    const css = buildBlockStyleOverridesCss({
      Button: { borderRadius: '9999px', paddingX: '1.5rem' },
    });

    expect(css).toBe(
      '.brisk-button { --brisk-override-radius: 9999px; --brisk-override-padding-x: 1.5rem; }',
    );
  });

  it('emits nothing (no rule at all) for a type whose override has every field unset', () => {
    const css = buildBlockStyleOverridesCss({ Button: {} });

    expect(css).toBe('');
  });

  it('emits one rule per type when multiple types are styled', () => {
    const css = buildBlockStyleOverridesCss({
      Button: { backgroundColor: '#ff0000' },
      PromoBar: { paddingY: '2rem' },
    });

    expect(css).toBe(
      '.brisk-button { --brisk-override-bg: #ff0000; }\n' +
        '.brisk-promo-bar { --brisk-override-padding-y: 2rem; }',
    );
  });

  it('returns an empty string for an empty map', () => {
    expect(buildBlockStyleOverridesCss({})).toBe('');
  });

  it('never emits a rule for marginTop/marginBottom — they are instance-only, not a per-type CSS override', () => {
    const css = buildBlockStyleOverridesCss({
      Button: { marginTop: '1rem', marginBottom: '2rem' },
    });

    expect(css).toBe('');
  });
});

describe('buildBlockInstanceStyle', () => {
  it('returns inline declarations for the fields present', () => {
    expect(
      buildBlockInstanceStyle({ textColor: '#000000', borderRadius: '4px' }),
    ).toBe('--brisk-override-text: #000000; --brisk-override-radius: 4px;');
  });

  it('returns undefined when the override is undefined', () => {
    expect(buildBlockInstanceStyle(undefined)).toBeUndefined();
  });

  it('returns undefined when every field is unset', () => {
    expect(buildBlockInstanceStyle({})).toBeUndefined();
  });

  it('never emits marginTop/marginBottom inline — they are applied directly by PublicPageContent.astro instead', () => {
    expect(
      buildBlockInstanceStyle({ marginTop: '1rem', marginBottom: '2rem' }),
    ).toBeUndefined();
  });
});

/**
 * These values are written straight into a `<style>` on the public site,
 * and the block type becomes the selector in front of them. Both were
 * interpolated raw, so anyone with edit rights could close our rule and
 * open one of their own — against a site they do not own.
 *
 * Not theory: `red; } body { … } .x {` produced a valid full-viewport
 * overlay, and `X { } body { display: none } .y` as a block type produced
 * exactly that rule.
 *
 * The schema refuses both at the entrance (site-theme-tokens.spec.ts).
 * This is the second barrier, at the exit, for what the schema cannot
 * see: rows written before it was tightened, a write path that forgets
 * it, a theme supplying its own defaults.
 */
describe('nothing reaches the stylesheet that could escape a declaration', () => {
  const BREAKOUTS = [
    'red; } body { display: none } .x {',
    'red@import url(//evil.example)',
    'red/* } body { display:none } .x { */',
    'red\\3B } body { display:none } .x {',
    '<style>x</style>',
  ];

  it.each(BREAKOUTS)('drops the declaration for %s', (hostile) => {
    expect(
      buildBlockStyleOverridesCss({ Hero: { backgroundColor: hostile } }),
    ).toBe('');
    expect(
      buildBlockInstanceStyle({ backgroundColor: hostile }),
    ).toBeUndefined();
  });

  it('drops a block type that is not an identifier, selector and all', () => {
    expect(
      buildBlockStyleOverridesCss({
        'X { } body { display: none } .y': { backgroundColor: 'red' },
      }),
    ).toBe('');
  });

  it('drops a value long enough to be a payload rather than a colour', () => {
    expect(
      buildBlockStyleOverridesCss({
        Hero: { backgroundColor: 'a'.repeat(201) },
      }),
    ).toBe('');
  });

  // The point of a character rule rather than a CSS grammar: everything
  // people actually write still goes through.
  it.each([
    '#fff',
    'oklch(0.7 0.1 250)',
    'rgb(0 0 0 / 50%)',
    'var(--primary)',
    'calc(100% - 2rem)',
    'transparent',
  ])('keeps %s', (value) => {
    expect(
      buildBlockStyleOverridesCss({ Hero: { backgroundColor: value } }),
    ).toContain(value);
  });
});
