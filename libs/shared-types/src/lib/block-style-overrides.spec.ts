import { describe, expect, it } from 'vitest';
import {
  blockInstanceClassName,
  blockTypeToClassName,
  buildBlockInstanceRulesCss,
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

    // Wrapped in its named tier: a per-type rule and a per-instance rule
    // have identical specificity, so without `@layer` the winner would be
    // whichever happened to be emitted last (ADR-0047).
    expect(css).toBe(
      '@layer brisk.class {\n' +
        '.brisk-button { --brisk-override-radius: 9999px; --brisk-override-padding-x: 1.5rem; }\n' +
        '}',
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
      '@layer brisk.class {\n' +
        '.brisk-button { --brisk-override-bg: #ff0000; }\n' +
        '.brisk-promo-bar { --brisk-override-padding-y: 2rem; }\n' +
        '}',
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

/**
 * The per-instance override stopped being an inline `style` attribute
 * (ADR-0047), for one reason that is not negotiable: **an HTML `style`
 * attribute cannot contain a media query**. Per-breakpoint styling per
 * instance is impossible while the value stays inline, so it became a
 * rule — and a rule needs a class and a named tier to win against the
 * per-type rule it now ties with on specificity.
 */
describe('buildBlockInstanceRulesCss', () => {
  it('emits one rule per styled block, in the instance tier', () => {
    expect(
      buildBlockInstanceRulesCss([
        [
          {
            id: 'a1',
            type: 'Hero',
            props: {},
            styleOverride: { minHeight: '60vh' },
          },
        ],
      ]),
    ).toBe(
      '@layer brisk.instance {\n.b-a1 { --brisk-override-min-height: 60vh; }\n}',
    );
  });

  it('reaches a styled block nested inside a container', () => {
    const css = buildBlockInstanceRulesCss([
      [
        {
          id: 'c1',
          type: 'Container',
          props: {},
          children: [
            {
              id: 'n1',
              type: 'Text',
              props: {},
              styleOverride: { gap: '2rem' },
            },
          ],
        },
      ],
    ]);

    expect(css).toContain('.b-n1 { --brisk-override-gap: 2rem; }');
  });

  it('takes header and footer trees alongside the page content', () => {
    const css = buildBlockInstanceRulesCss([
      [{ id: 'p1', type: 'Text', props: {}, styleOverride: { gap: '1rem' } }],
      [
        {
          id: 'h1',
          type: 'NavLink',
          props: {},
          styleOverride: { gap: '2rem' },
        },
      ],
    ]);

    expect(css).toContain('.b-p1');
    expect(css).toContain('.b-h1');
  });

  it('emits nothing when no block is styled, so an ordinary page carries no extra bytes', () => {
    expect(
      buildBlockInstanceRulesCss([[{ id: 'a1', type: 'Hero', props: {} }]]),
    ).toBe('');
  });

  // The block id becomes a selector, so it is checked where it gets there
  // — the same rule the block TYPE key already follows.
  it('drops a block whose id is not one, selector and all', () => {
    expect(
      buildBlockInstanceRulesCss([
        [
          {
            id: 'a" { } body { display: none } .y',
            type: 'Hero',
            props: {},
            styleOverride: { minHeight: '1px' },
          },
        ],
      ]),
    ).toBe('');
  });
});

describe('blockInstanceClassName', () => {
  it('builds a class from a real block id', () => {
    expect(blockInstanceClassName('9f3a1c72-0000-4000-8000-000000000001')).toBe(
      'b-9f3a1c72-0000-4000-8000-000000000001',
    );
  });

  it.each(['a b', 'a{b', 'a"b', '', 'a'.repeat(65)])('refuses %s', (id) => {
    expect(blockInstanceClassName(id)).toBeNull();
  });
});
