import { beforeEach, describe, expect, it } from 'vitest';
import { PageTranslation, Site } from '@brisk/domain-core';
import { DEFAULT_COOKIE_BANNER_SETTINGS } from '@brisk/shared-types';
import {
  InMemoryPageTranslationRepository,
  InMemorySiteRepository,
  InMemoryTaxonomyRepository,
} from './in-memory-repositories.test-fixture';
import {
  createTaxonomy,
  createTerm,
  deleteTaxonomy,
  moveTerm,
  setPageGroupTerms,
  updateTaxonomy,
  updateTerm,
} from './taxonomy.use-cases';
import { assertPageSlugFreeOfTerms, termAddress } from './term-address';

const tenantId = 'tenant-1';
const siteId = 'site-1';

describe('taxonomy use cases', () => {
  let taxonomyRepository: InMemoryTaxonomyRepository;
  let pageTranslationRepository: InMemoryPageTranslationRepository;
  let siteRepository: InMemorySiteRepository;

  function deps() {
    return { taxonomyRepository, pageTranslationRepository, siteRepository };
  }

  beforeEach(async () => {
    taxonomyRepository = new InMemoryTaxonomyRepository();
    pageTranslationRepository = new InMemoryPageTranslationRepository();
    siteRepository = new InMemorySiteRepository();
    await siteRepository.save(
      Site.fromProps({
        id: siteId,
        tenantId,
        name: 'Sito',
        domain: 'example.com',
        themeName: 'classic',
        defaultLocale: 'it',
        enabledLocales: ['it', 'en'],
        untranslatedPageFallback: 'redirect-to-default',
        businessAddress: null,
        businessPhone: null,
        businessType: null,
        openingHours: null,
        searchEngineIndexingEnabled: false,
        themePrimaryColor: null,
        themeSecondaryColor: null,
        themeFontFamily: null,
        themeCustomCss: null,
        themeContentWidth: null,
        themeHeadScript: null,
        themeBodyScript: null,
        themeFaviconUrl: null,
        themeOverridesEnabled: true,
        themeAllowedTrackerDomains: [],
        formSubmissionRetentionDays: null,
        themeTrackerScripts: [],
        cookieBannerSettings: DEFAULT_COOKIE_BANNER_SETTINGS,
        createdAt: new Date(),
      }),
    );
  });

  async function seedRootPage(locale: string, slug: string) {
    await pageTranslationRepository.save(
      PageTranslation.create({
        id: `page-${locale}-${slug}`,
        tenantId,
        siteId,
        pageGroupId: `group-${slug}`,
        locale,
        slug,
        seoMeta: { title: slug, description: '' },
        createdBy: null,
      }),
      null,
    );
  }

  it('derives the prefix from the name, as a URL segment', async () => {
    const taxonomy = await createTaxonomy(deps(), {
      tenantId,
      siteId,
      name: { it: 'Categoria prodotti' },
    });

    expect(taxonomy.prefix).toBe('categoria-prodotti');
  });

  /*
   * Several dimensions at the site root is deliberate — it is the "pretty
   * URL" case (docs/adr/0064). What keeps their terms apart is the
   * address check, not this one.
   */
  it('lets more than one dimension live at the root', async () => {
    await createTaxonomy(deps(), {
      tenantId,
      siteId,
      name: { it: 'Categoria' },
      prefix: null,
    });

    await expect(
      createTaxonomy(deps(), {
        tenantId,
        siteId,
        name: { it: 'Famiglia' },
        prefix: null,
      }),
    ).resolves.toBeTruthy();
  });

  it('refuses a prefix another dimension already uses', async () => {
    await createTaxonomy(deps(), {
      tenantId,
      siteId,
      name: { it: 'Categoria' },
    });

    await expect(
      createTaxonomy(deps(), {
        tenantId,
        siteId,
        name: { it: 'Categoria' },
      }),
    ).rejects.toThrow('prefix');
  });

  /*
   * The comparison no database constraint can make: terms and pages live
   * in different tables and meet only in the URL.
   */
  it('refuses a prefix a root page already answers to, in any language', async () => {
    await seedRootPage('en', 'category');

    await expect(
      createTaxonomy(deps(), {
        tenantId,
        siteId,
        name: { it: 'Category' },
      }),
    ).rejects.toThrow('page already answers');
  });

  it('gives a term one address per language of its name', async () => {
    const taxonomy = await createTaxonomy(deps(), {
      tenantId,
      siteId,
      name: { it: 'Categoria' },
    });

    const term = await createTerm(deps(), {
      tenantId,
      taxonomyId: taxonomy.id,
      name: { it: 'Macchine da caffè', en: 'Coffee machines' },
    });

    expect(term.slugs).toEqual({
      it: 'macchine-da-caffe',
      en: 'coffee-machines',
    });
    expect(termAddress(taxonomy.prefix, term.slugs['it'])).toBe(
      'categoria/macchine-da-caffe',
    );
  });

  it('refuses a term address another term already answers', async () => {
    const taxonomy = await createTaxonomy(deps(), {
      tenantId,
      siteId,
      name: { it: 'Categoria' },
    });
    await createTerm(deps(), {
      tenantId,
      taxonomyId: taxonomy.id,
      name: { it: 'Espresso' },
    });

    await expect(
      createTerm(deps(), {
        tenantId,
        taxonomyId: taxonomy.id,
        name: { it: 'Espresso' },
      }),
    ).rejects.toThrow('already answers');
  });

  it('refuses a ROOT-mounted term that lands on a page', async () => {
    await seedRootPage('it', 'espresso');
    const taxonomy = await createTaxonomy(deps(), {
      tenantId,
      siteId,
      name: { it: 'Categoria' },
      prefix: null,
    });

    await expect(
      createTerm(deps(), {
        tenantId,
        taxonomyId: taxonomy.id,
        name: { it: 'Espresso' },
      }),
    ).rejects.toThrow('page already answers');
  });

  /*
   * The same slug behind a prefix is NOT a collision: `/it/espresso` and
   * `/it/categoria/espresso` are two addresses.
   */
  it('allows a term slug equal to a page slug when the dimension has a prefix', async () => {
    await seedRootPage('it', 'espresso');
    const taxonomy = await createTaxonomy(deps(), {
      tenantId,
      siteId,
      name: { it: 'Categoria' },
    });

    await expect(
      createTerm(deps(), {
        tenantId,
        taxonomyId: taxonomy.id,
        name: { it: 'Espresso' },
      }),
    ).resolves.toBeTruthy();
  });

  it('moves every term of a dimension when its prefix changes', async () => {
    const taxonomy = await createTaxonomy(deps(), {
      tenantId,
      siteId,
      name: { it: 'Categoria' },
    });
    const term = await createTerm(deps(), {
      tenantId,
      taxonomyId: taxonomy.id,
      name: { it: 'Espresso' },
    });

    await updateTaxonomy(deps(), {
      tenantId,
      id: taxonomy.id,
      prefix: 'famiglia',
    });

    expect(
      await taxonomyRepository.findTermByAddress(
        tenantId,
        siteId,
        'it',
        'famiglia',
        'espresso',
      ),
    ).toEqual(term);
    expect(
      await taxonomyRepository.findTermByAddress(
        tenantId,
        siteId,
        'it',
        'categoria',
        'espresso',
      ),
    ).toBeNull();
  });

  it('refuses to turn nesting off while terms are nested', async () => {
    const taxonomy = await createTaxonomy(deps(), {
      tenantId,
      siteId,
      name: { it: 'Categoria' },
    });
    const parent = await createTerm(deps(), {
      tenantId,
      taxonomyId: taxonomy.id,
      name: { it: 'Macchine' },
    });
    await createTerm(deps(), {
      tenantId,
      taxonomyId: taxonomy.id,
      name: { it: 'Automatiche' },
      parentId: parent.id,
    });

    await expect(
      updateTaxonomy(deps(), {
        tenantId,
        id: taxonomy.id,
        hierarchical: false,
      }),
    ).rejects.toThrow('nested terms');
  });

  it('refuses a parent that is the term own descendant', async () => {
    const taxonomy = await createTaxonomy(deps(), {
      tenantId,
      siteId,
      name: { it: 'Categoria' },
    });
    const grandparent = await createTerm(deps(), {
      tenantId,
      taxonomyId: taxonomy.id,
      name: { it: 'Macchine' },
    });
    const child = await createTerm(deps(), {
      tenantId,
      taxonomyId: taxonomy.id,
      name: { it: 'Automatiche' },
      parentId: grandparent.id,
    });

    await expect(
      moveTerm(deps(), {
        tenantId,
        id: grandparent.id,
        parentId: child.id,
      }),
    ).rejects.toThrow('own descendant');
  });

  /*
   * A term's address has no ancestors in it, so re-filing one leaves
   * every link to it working — the reason the flat form was chosen.
   */
  it('keeps a term address when it is re-filed under another parent', async () => {
    const taxonomy = await createTaxonomy(deps(), {
      tenantId,
      siteId,
      name: { it: 'Categoria' },
    });
    const parent = await createTerm(deps(), {
      tenantId,
      taxonomyId: taxonomy.id,
      name: { it: 'Macchine' },
    });
    const term = await createTerm(deps(), {
      tenantId,
      taxonomyId: taxonomy.id,
      name: { it: 'Automatiche' },
    });

    const moved = await moveTerm(deps(), {
      tenantId,
      id: term.id,
      parentId: parent.id,
    });

    expect(moved.parentId).toBe(parent.id);
    expect(moved.slugs).toEqual({ it: 'automatiche' });
  });

  it('drops the address of a language removed from a term', async () => {
    const taxonomy = await createTaxonomy(deps(), {
      tenantId,
      siteId,
      name: { it: 'Categoria' },
    });
    const term = await createTerm(deps(), {
      tenantId,
      taxonomyId: taxonomy.id,
      name: { it: 'Espresso', en: 'Espresso' },
    });

    const updated = await updateTerm(deps(), {
      tenantId,
      id: term.id,
      slugs: { it: 'espresso' },
    });

    expect(updated.slugs).toEqual({ it: 'espresso' });
  });

  it('files a page under the terms it is given, once each', async () => {
    const taxonomy = await createTaxonomy(deps(), {
      tenantId,
      siteId,
      name: { it: 'Categoria' },
    });
    const term = await createTerm(deps(), {
      tenantId,
      taxonomyId: taxonomy.id,
      name: { it: 'Espresso' },
    });

    const stored = await setPageGroupTerms(deps(), {
      tenantId,
      pageGroupId: 'group-1',
      termIds: [term.id, term.id],
    });

    expect(stored).toEqual([term.id]);
  });

  it('refuses to file a page under a term that does not exist', async () => {
    await expect(
      setPageGroupTerms(deps(), {
        tenantId,
        pageGroupId: 'group-1',
        termIds: ['nope'],
      }),
    ).rejects.toThrow('Term not found');
  });

  it('forgets a dimension terms when the dimension goes', async () => {
    const taxonomy = await createTaxonomy(deps(), {
      tenantId,
      siteId,
      name: { it: 'Categoria' },
    });
    await createTerm(deps(), {
      tenantId,
      taxonomyId: taxonomy.id,
      name: { it: 'Espresso' },
    });

    await deleteTaxonomy(deps(), tenantId, taxonomy.id);

    expect(await taxonomyRepository.listTermsBySite(tenantId, siteId)).toEqual(
      [],
    );
  });

  /*
   * The third place the rule has to hold. Without it terms would refuse
   * to land on pages while pages landed on terms freely, and which one
   * won would depend on the order the router tried them.
   */
  it('refuses a root page slug a dimension or a root-mounted term already answers', async () => {
    const rootMounted = await createTaxonomy(deps(), {
      tenantId,
      siteId,
      name: { it: 'Famiglia' },
      prefix: null,
    });
    await createTerm(deps(), {
      tenantId,
      taxonomyId: rootMounted.id,
      name: { it: 'Espresso' },
    });
    await createTaxonomy(deps(), {
      tenantId,
      siteId,
      name: { it: 'Categoria' },
    });

    await expect(
      assertPageSlugFreeOfTerms(deps(), {
        tenantId,
        siteId,
        locale: 'it',
        slug: 'espresso',
      }),
    ).rejects.toThrow('already answers');
    await expect(
      assertPageSlugFreeOfTerms(deps(), {
        tenantId,
        siteId,
        locale: 'it',
        slug: 'categoria',
      }),
    ).rejects.toThrow('already answers');
    await expect(
      assertPageSlugFreeOfTerms(deps(), {
        tenantId,
        siteId,
        locale: 'it',
        slug: 'contatti',
      }),
    ).resolves.toBeUndefined();
  });
});
