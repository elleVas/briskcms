import { describe, expect, it } from 'vitest';
import {
  collectThemeBlockCandidates,
  validateThemeBlockSet,
  type BlockDescriptor,
} from '@brisk/block-sdk';
import { headerFooterBlocks, pageBlocks } from '@brisk/block-registry';
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

    // See themes/classic/blocks/blocks.spec.ts's own comment: this is
    // the one reliable, always-runs-in-CI place a core-type collision
    // gets caught — apps/public-site's own runtime check can't safely
    // import block-registry, so it's a backstop, not the primary gate.
    const coreBlockTypes = new Set(
      [...pageBlocks, ...headerFooterBlocks].map((block) => block.type),
    );
    const collisions = candidates
      .map((candidate) => candidate.descriptor.type)
      .filter((type) => coreBlockTypes.has(type));
    expect(collisions).toEqual([]);
  });
});
