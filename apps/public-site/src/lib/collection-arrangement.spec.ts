import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pageBlocks } from '@brisk/block-registry';

const BLOCKS_DIR = join(import.meta.dirname, '../components/blocks');

/*
 * Two invariants about the shared arrangement engine (ADR-0052), both
 * pinning a mistake that was actually made while building it and that no
 * other test could see.
 */
describe('collection arrangement engine', () => {
  const usesLayout = readdirSync(BLOCKS_DIR)
    .filter((file) => file.endsWith('.astro'))
    .map((file) => ({
      file,
      source: readFileSync(join(BLOCKS_DIR, file), 'utf8'),
    }))
    .filter((block) => block.source.includes('CollectionLayout'));

  it('covers every block that hands its arrangement over', () => {
    // A guard on the guard: if this list ever empties, the two checks
    // below would pass by vacuum.
    expect(usesLayout.length).toBeGreaterThanOrEqual(6);
  });

  it.each(usesLayout.map((b) => b.file))(
    '%s styles its own class globally, because CollectionLayout renders it',
    (file) => {
      const source = usesLayout.find((b) => b.file === file)?.source ?? '';
      const styleBlock = source.slice(source.indexOf('<style>'));
      // Strip what is already inside a `:global(...)`, then nothing that
      // targets this engine's elements should be left: Astro scopes a
      // component's styles to the elements IT renders, and the root here
      // is rendered by CollectionLayout. A scoped rule simply never
      // matches — the block silently lost its grid entirely, measured as
      // `display: block` on the built page.
      const outsideGlobal = styleBlock.replace(/:global\([^)]*\)/g, '');
      const stranded = [...outsideGlobal.matchAll(/\.brisk-[\w-]+/g)].map(
        (match) => match[0],
      );

      expect(
        stranded,
        `${file}: these selectors must sit inside :global()`,
      ).toEqual([]);
    },
  );

  it('gives every block with a display prop the locale its nav labels need', () => {
    // CollectionLayout translates the prev/next labels, so a block that
    // forgets `locale: true` in the renderer throws at render time.
    const renderer = readFileSync(
      join(import.meta.dirname, '../components/BlockRenderer.astro'),
      'utf8',
    );
    const withDisplay = pageBlocks
      .filter((descriptor) =>
        descriptor.fields.some((field) => field.key === 'display'),
      )
      .map((descriptor) => descriptor.type);

    expect(withDisplay.length).toBeGreaterThan(0);
    for (const type of withDisplay) {
      const start = renderer.indexOf(`\n  ${type}: {`);
      expect(start, `${type} missing from the renderer`).toBeGreaterThan(-1);
      const entry = renderer.slice(start, renderer.indexOf('\n  },', start));
      expect(entry, `${type} needs locale: true`).toContain('locale: true');
    }
  });
});
