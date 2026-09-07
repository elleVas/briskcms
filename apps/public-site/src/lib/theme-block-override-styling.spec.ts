import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { headerFooterBlocks, pageBlocks } from '@brisk/block-registry';

const THEMES_DIR = join(import.meta.dirname, '../../../../themes');

/**
 * A theme may replace any core block's `.astro` outright (ADR-0021's
 * per-block escalation) — same props, its own markup. Since ADR-0047 those
 * props include `instanceClass`: the per-instance override is a generated
 * CSS rule, and the rule targets a class the component has to put on its
 * root element. A replacement that ignores it silently drops per-instance
 * styling for that block type, on every page of every site using the
 * theme.
 *
 * Silently is the word that makes this a test. The rule is still emitted
 * into the page, so the mechanism looks alive from the outside: the
 * stylesheet is right there in the HTML, matching nothing. Whoever set the
 * colour would see the canvas obey and the published page not, with
 * nothing anywhere reporting a fault — and this is exactly how it was
 * found, on this repository's own docs site.
 */
describe('a theme override keeps per-instance styling working', () => {
  const stylableCoreTypes = new Set(
    [...pageBlocks, ...headerFooterBlocks]
      .filter((descriptor) => (descriptor.stylableProperties?.length ?? 0) > 0)
      .map((descriptor) => descriptor.type),
  );

  /** Every `<Type>.astro` in a theme that REPLACES a stylable core block — a file with a sibling `.block.ts` is a new type of the theme's own, not a replacement. */
  const overrides = readdirSync(THEMES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((theme) => {
      const blocksDir = join(THEMES_DIR, theme.name, 'blocks');
      if (!existsSync(blocksDir)) {
        return [];
      }
      return readdirSync(blocksDir)
        .filter((file) => file.endsWith('.astro'))
        .map((file) => ({
          theme: theme.name,
          type: file.slice(0, -'.astro'.length),
          path: join(blocksDir, file),
        }))
        .filter(
          (block) =>
            stylableCoreTypes.has(block.type) &&
            !existsSync(join(blocksDir, `${block.type}.block.ts`)),
        );
    });

  it('finds the overrides it is meant to be checking', () => {
    expect(stylableCoreTypes.size).toBeGreaterThan(0);
    expect(overrides.length).toBeGreaterThan(0);
  });

  it.each(overrides.map((o) => [`${o.theme}/${o.type}`, o.path] as const))(
    '%s accepts and renders instanceClass',
    (_name, path) => {
      const source = readFileSync(path, 'utf8');
      expect(source).toContain('instanceClass');
      // Declared in Props and then never put on an element would fail the
      // same way as never declaring it.
      expect(source).toMatch(/class:list=\{\[[\s\S]*?instanceClass/);
    },
  );
});
