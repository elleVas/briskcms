import { describe, expect, it } from 'vitest';
import {
  collectThemeBlockCandidates,
  validateThemeBlockSet,
  type BlockDescriptor,
} from '@brisk/block-sdk';
import { headerFooterBlocks, pageBlocks } from '@brisk/block-registry';
import type { ThemeBlockLocales } from '@brisk/shared-types';

/**
 * Docs/adr/0041 — every theme's own gate for the blocks it declares
 * under `blocks/`. Runs for real in CI (this theme is now a real Nx
 * project, see themes/README.md), not just for whichever theme happens
 * to be the active BRISK_THEME at build time.
 *
 * `classic` ships no extension blocks yet — this stays here, green and
 * trivial, so the very first block a dev adds here is checked the same
 * way from day one, instead of needing this file created at that point.
 */
describe('classic theme blocks', () => {
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

    expect(validateThemeBlockSet(candidates)).toEqual([]);

    // Core-type collisions live here, not in `validateThemeBlockSet`
    // (block-sdk can't depend on block-registry, ADR-0037's dependency
    // direction) — but a theme package can (both "app"-tagged, and
    // block-registry is "domain"). This is the one check in the whole
    // mechanism that's only reliable when run here: apps/public-site's
    // own runtime check (resolve-theme-page-blocks.ts) can't safely
    // import block-registry either, so it depends on a real page having
    // rendered first — fine as a defense-in-depth backstop, but this CI
    // check is what actually guarantees "collision = build fails",
    // unconditionally, before anything ships.
    const coreBlockTypes = new Set(
      [...pageBlocks, ...headerFooterBlocks].map((block) => block.type),
    );
    const collisions = candidates
      .map((candidate) => candidate.descriptor.type)
      .filter((type) => coreBlockTypes.has(type));
    expect(collisions).toEqual([]);
  });
});
