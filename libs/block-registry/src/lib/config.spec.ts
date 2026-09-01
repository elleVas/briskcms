import { describe, expect, it } from 'vitest';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import { pageBlockCategories, pageBlocks } from './config';
import { headerFooterBlocks } from './layout-config';

describe('pageBlocks', () => {
  // Security review 2026-08-24: not a literal count — that broke for the
  // wrong reason (a legitimate new block) every time one was added/removed.
  // What actually matters is that every registered type is unique.
  it('registers page blocks, each with a unique type', () => {
    expect(pageBlocks.length).toBeGreaterThan(0);
    const types = pageBlocks.map((block) => block.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it('gives every block a label, category, defaultProps and fields array', () => {
    for (const block of pageBlocks) {
      expect(block.label.length).toBeGreaterThan(0);
      expect(block.category.length).toBeGreaterThan(0);
      expect(block.defaultProps).toBeTypeOf('object');
      expect(Array.isArray(block.fields)).toBe(true);
    }
  });

  it('never lets a `render` function slip back in (data only, per the plan)', () => {
    for (const block of pageBlocks) {
      expect('render' in block).toBe(false);
    }
  });
});

describe('pageBlockCategories', () => {
  it('places every registered block type in exactly one category, with no leftovers', () => {
    const registeredTypes = pageBlocks.map((block) => block.type).sort();
    const categorizedTypes = pageBlockCategories
      .flatMap((category) => category.types)
      .sort();

    expect(categorizedTypes).toEqual(registeredTypes);
  });

  it('never lists the same type in two categories', () => {
    const allTypes = pageBlockCategories.flatMap((category) => category.types);
    expect(new Set(allTypes).size).toBe(allTypes.length);
  });
});

// i18n a livello di campo (struttura condivisa + override per-locale):
// `translatable` è opt-in esplicito, mai dedotto da `kind`/`inlineEditable`
// (Image.alt è traducibile ma non inlineEditable — nessuna euristica
// automatica è affidabile). Spot-check sulle decisioni meno ovvie
// dell'audit, non esaustivo: il resto è auto-documentato nei singoli
// *.block.ts.
describe('translatable field audit spot-checks', () => {
  function fieldOf(type: string, key: string) {
    const block = pageBlocks.find((b) => b.type === type);
    if (!block) throw new Error(`Test fixture is missing block type "${type}"`);
    const field = block.fields.find(
      (f): f is Extract<typeof f, { key: string }> => f.key === key,
    );
    if (!field)
      throw new Error(`Test fixture is missing field "${key}" on "${type}"`);
    return field;
  }

  it('marks ordinary text content as translatable', () => {
    expect(
      (fieldOf('Hero', 'title') as { translatable?: boolean }).translatable,
    ).toBe(true);
    expect(
      (fieldOf('Text', 'body') as { translatable?: boolean }).translatable,
    ).toBe(true);
    expect(
      (fieldOf('Image', 'alt') as { translatable?: boolean }).translatable,
    ).toBe(true);
  });

  it("leaves a person's proper name untranslated (shared across locales)", () => {
    expect(
      (fieldOf('Testimonial', 'author') as { translatable?: boolean })
        .translatable,
    ).not.toBe(true);
    expect(
      (fieldOf('TeamMember', 'name') as { translatable?: boolean })
        .translatable,
    ).not.toBe(true);
  });

  it('leaves structural/data fields (video/date) untranslated', () => {
    expect(
      (fieldOf('VideoEmbed', 'url') as { translatable?: boolean }).translatable,
    ).not.toBe(true);
    expect(
      (fieldOf('Countdown', 'targetDate') as { translatable?: boolean })
        .translatable,
    ).not.toBe(true);
  });

  // Found live during the i18n backfill against real docs-showcase content
  // (not just theorized): a real site used ctaLinkFields()'s `url` for a
  // hand-typed internal path ("/it/docs"), not just a true external link —
  // marked translatable after the fact, this locks the correction in.
  it("marks ctaLinkFields()'s shared `url` field as translatable — internal relative paths must vary by locale", () => {
    expect(
      (fieldOf('Button', 'url') as { translatable?: boolean }).translatable,
    ).toBe(true);
    expect(
      (fieldOf('Banner', 'url') as { translatable?: boolean }).translatable,
    ).toBe(true);
  });

  // Found live during round-trip verification of the i18n backfill (not
  // just theorized): real Code blocks embed human-language comments in the
  // snippet (e.g. "# overrides Hero") that were hand-translated per locale
  // under the old duplicated-page model — locks the correction in.
  it('marks Code.code as translatable — snippets can embed human-language comments', () => {
    expect(
      (fieldOf('Code', 'code') as { translatable?: boolean }).translatable,
    ).toBe(true);
  });
});

// Security review 2026-08-24, point 16: nulla verificava che
// `stylableProperties` di un blocco corrispondesse alle chiavi presenti in
// `BLOCK_STYLE_DEFAULTS` — un disallineamento (es. un blocco dichiara
// `backgroundColor` ma il suo `BLOCK_STYLE_DEFAULTS` non la definisce)
// passava inosservato. header/footer + page blocks insieme (Text/Image/
// SearchBox condivisi tra i due, deduplicati per tipo).
describe('stylableProperties / BLOCK_STYLE_DEFAULTS alignment', () => {
  const allBlocksByType = new Map(
    [...pageBlocks, ...headerFooterBlocks].map((block) => [block.type, block]),
  );

  it('gives every block with stylableProperties a BLOCK_STYLE_DEFAULTS entry with exactly those keys', () => {
    for (const block of allBlocksByType.values()) {
      if (!block.stylableProperties || block.stylableProperties.length === 0) {
        continue;
      }
      const defaults = BLOCK_STYLE_DEFAULTS[block.type];
      expect(
        defaults,
        `${block.type} declares stylableProperties but has no BLOCK_STYLE_DEFAULTS entry`,
      ).toBeDefined();
      expect(Object.keys(defaults ?? {}).sort()).toEqual(
        [...block.stylableProperties].sort(),
      );
    }
  });
});
