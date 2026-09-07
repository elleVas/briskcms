import { describe, expect, it } from 'vitest';
import {
  checkStylePropertiesAgainstCore,
  checkVariantsAgainstCore,
  collectThemeBlockCandidates,
  collectThemeStyleProperties,
  collectThemeVariantExtensions,
  findCoreBlockTypeCollisions,
  validateThemeBlockSet,
  validateThemeStyleProperties,
  validateThemeVariantExtensions,
  CORE_BLOCK_TYPES,
  CORE_BLOCK_VARIANTS,
  type BlockDescriptor,
  type ThemeBlockVariant,
  type ThemeStyleProperty,
} from '@brisk/block-sdk';
import type { ThemeBlockLocales } from '@brisk/shared-types';

/**
 * Docs/adr/0041 — see themes/classic/blocks/blocks.spec.ts's own comment
 * for why this exists per-theme. This theme also ships 4 pure overrides
 * of existing core block types (Button.astro, Code.astro, Hero.astro,
 * LanguageSwitcher.astro, no matching `.block.ts`) — the glob below picks
 * those up too, but `collectThemeBlockCandidates` only turns a
 * `.block.ts` file into a candidate, so they're correctly invisible to
 * this test (unchanged, pre-existing behavior, not a new type).
 */
describe('docs-showcase theme blocks', () => {
  it('has no validation errors', () => {
    const blockModules = import.meta.glob<{ default: BlockDescriptor }>(
      './*.block.ts',
      { eager: true },
    );
    // Non-eager: only the file paths (keys) are needed for the
    // existence check `collectThemeBlockCandidates` does — this vitest
    // project has no Astro Vite plugin (unlike apps/public-site, the
    // real consumer), so actually transforming `.astro` content here
    // would fail on syntax it can't parse.
    const astroModules = import.meta.glob('./*.astro');
    const localesModules = import.meta.glob<ThemeBlockLocales>(
      './*.locales.json',
      { eager: true, import: 'default' },
    );

    const candidates = collectThemeBlockCandidates(
      blockModules,
      astroModules,
      localesModules,
    );

    expect(candidates.map((c) => c.basename)).toEqual(['StatusBadge']);
    expect(validateThemeBlockSet(candidates)).toEqual([]);

    // See themes/classic/blocks/blocks.spec.ts for why this lives here and
    // why the type list comes from block-sdk rather than block-registry.
    expect(
      findCoreBlockTypeCollisions(
        candidates.map((candidate) => candidate.descriptor.type),
      ),
    ).toEqual([]);
  });
});

/**
 * The half of the variant-extension check that needs the core registry
 * (ADR-0047): the type being extended exists, and the theme is not
 * redeclaring a look core already ships.
 *
 * It lives here, per theme, for the same reason the block-type collision
 * check does: `apps/public-site` cannot import `@brisk/block-registry`
 * (a real TypeScript resolution conflict), while a theme package is
 * "app"-tagged and may. The runtime loader does the rest — names,
 * labels, a theme repeating itself — and this runs in CI, so a mistake
 * fails the build before anything ships.
 */
describe('docs-showcase variant extensions', () => {
  it('extend core types that exist, with looks core does not already have', () => {
    const variantModules = import.meta.glob<{ default: ThemeBlockVariant[] }>(
      './*.variants.ts',
      { eager: true },
    );
    const extensions = collectThemeVariantExtensions(variantModules);

    expect(extensions.map((extension) => extension.blockType)).toEqual([
      'Button',
    ]);
    expect(validateThemeVariantExtensions(extensions, ['en', 'it'])).toEqual(
      [],
    );

    // Both lists come from block-sdk, never from `@brisk/block-registry`
    // — the same reason as the collision check above: depending on that
    // package here is what used to make a theme undevelopable outside
    // this monorepo. block-registry's own core-block-types.spec.ts keeps
    // them honest.
    expect(
      checkVariantsAgainstCore(
        extensions,
        CORE_BLOCK_VARIANTS,
        CORE_BLOCK_TYPES,
      ),
    ).toEqual([]);
  });
});

/**
 * The same split for the style properties this theme adds to core blocks
 * (ADR-0047): the loader checks keys, controls and labels, and the two
 * checks needing the core list live here.
 */
describe('docs-showcase style property extensions', () => {
  it('extend core types that exist, with properties core does not ship', () => {
    const styleModules = import.meta.glob<{ default: ThemeStyleProperty[] }>(
      './*.style.ts',
      { eager: true },
    );
    const extensions = collectThemeStyleProperties(styleModules);

    expect(extensions.map((extension) => extension.blockType)).toEqual([
      'Code',
    ]);
    expect(validateThemeStyleProperties(extensions, ['en', 'it'])).toEqual([]);
    expect(
      checkStylePropertiesAgainstCore(extensions, CORE_BLOCK_TYPES),
    ).toEqual([]);
  });
});
