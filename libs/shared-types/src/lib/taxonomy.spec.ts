import { describe, expect, it } from 'vitest';
import {
  localizedSeoMetaSchema,
  localizedTextSchema,
  taxonomySchema,
  termSchema,
} from './taxonomy';

describe('localized values', () => {
  it('accepts any locale a site happens to have', () => {
    const parsed = localizedTextSchema.parse({ it: 'Caffè', 'pt-BR': 'Café' });

    expect(parsed['pt-BR']).toBe('Café');
  });

  /*
   * A missing language is not an error: a term is a concept that exists
   * whether or not somebody has written its name in Norwegian yet, and
   * the caller falls back the way every other locale-keyed value here
   * does.
   */
  it('accepts a value that exists in no language yet', () => {
    expect(localizedTextSchema.parse({})).toEqual({});
  });

  it('validates the SEO block per language with the schema pages already use', () => {
    expect(() =>
      localizedSeoMetaSchema.parse({ it: { title: 'Caffè' } }),
    ).toThrow();
    expect(
      localizedSeoMetaSchema.parse({
        it: { title: 'Caffè', description: 'Le macchine' },
      }).it.description,
    ).toBe('Le macchine');
  });
});

describe('taxonomySchema', () => {
  /*
   * The prefix is nullable and that is the feature, not an oversight:
   * `null` mounts the dimension's terms at the site root
   * (`/it/espresso`) instead of behind `/it/categoria/`.
   */
  it('accepts a dimension with no URL prefix', () => {
    const parsed = taxonomySchema.parse({
      id: 't1',
      siteId: 's1',
      slug: null,
      name: { it: 'Categoria' },
      hierarchical: true,
      order: 0,
    });

    expect(parsed.slug).toBeNull();
  });

  it('refuses a missing prefix — absent is not the same as deliberately none', () => {
    expect(() =>
      taxonomySchema.parse({
        id: 't1',
        siteId: 's1',
        name: {},
        hierarchical: true,
        order: 0,
      }),
    ).toThrow();
  });
});

describe('termSchema', () => {
  it('carries a slug per language and nothing forcing them to agree', () => {
    const parsed = termSchema.parse({
      id: 'x1',
      siteId: 's1',
      taxonomyId: 't1',
      parentId: null,
      name: { it: 'Macchine', en: 'Machines' },
      description: {},
      seoMeta: {},
      landingPageGroupId: null,
      order: 0,
      slugs: { it: 'macchine', en: 'machines' },
    });

    expect(parsed.slugs).toEqual({ it: 'macchine', en: 'machines' });
  });

  it('accepts a term with a hand-built landing page', () => {
    const parsed = termSchema.parse({
      id: 'x1',
      siteId: 's1',
      taxonomyId: 't1',
      parentId: 'x0',
      name: {},
      description: {},
      seoMeta: {},
      landingPageGroupId: 'g1',
      order: 3,
      slugs: {},
    });

    expect(parsed.landingPageGroupId).toBe('g1');
    expect(parsed.parentId).toBe('x0');
  });
});
