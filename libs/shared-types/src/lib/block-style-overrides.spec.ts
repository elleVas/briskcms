import { describe, expect, it } from 'vitest';
import {
  blockTypeToClassName,
  buildBlockInstanceStyle,
  buildBlockStyleOverridesCss,
} from './block-style-overrides.js';

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
