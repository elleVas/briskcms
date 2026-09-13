import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { headerFooterBlocks, pageBlocks } from '@brisk/block-registry';

const RENDERER = readFileSync(
  join(import.meta.dirname, '../components/BlockRenderer.astro'),
  'utf8',
);

/**
 * Each `BLOCK_REGISTRY` entry's source, by type: the lines from
 * `  Type: {` to the `  },` that closes it at the same indentation.
 */
function dispatchEntries(): Map<string, string> {
  const start = RENDERER.indexOf('const BLOCK_REGISTRY');
  const end = RENDERER.indexOf('\n};', start);
  const body = RENDERER.slice(start, end);
  const entries = new Map<string, string>();
  for (const match of body.matchAll(
    /^ {2}([A-Z]\w*): \{([\s\S]*?)^ {2}\},?$/gm,
  )) {
    entries.set(match[1], match[2]);
  }
  // One-line entries: `  Divider: { component: Divider, ... },`
  for (const match of body.matchAll(/^ {2}([A-Z]\w*): \{([^\n]*)\},?$/gm)) {
    entries.set(match[1], match[2]);
  }
  return entries;
}

/**
 * `BlockDescriptor.rendersFromChildren` is the editor's only way to know
 * that editing a child has to re-render its parent — and the only thing
 * that decides it is here, in BlockRenderer, where a container is handed
 * `ctx.block.children`. The two drifting apart is invisible: the published
 * page is right, and the canvas quietly shows an index or a playlist that
 * no longer matches what was typed.
 */
describe('rendersFromChildren matches what BlockRenderer reads', () => {
  const entries = dispatchEntries();
  const descriptors = new Map(
    [...pageBlocks, ...headerFooterBlocks].map((d) => [d.type, d]),
  );

  it('reads the dispatch table it is meant to be checking', () => {
    expect(entries.size).toBeGreaterThan(100);
    expect(entries.get('Faq')).toContain('ctx.block.children');
  });

  it('flags every container whose rendering reads its children', () => {
    const readers = [...entries]
      .filter(([, source]) => source.includes('ctx.block.children'))
      .map(([type]) => type)
      .sort();
    const flagged = [...descriptors.values()]
      .filter((d) => d.rendersFromChildren)
      .map((d) => d.type)
      .sort();

    expect(flagged).toEqual(readers);
  });
});
