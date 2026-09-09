import { describe, expect, it } from 'vitest';
import { DEFAULT_COOKIE_BANNER_SETTINGS } from '@brisk/shared-types';
import { Site, Taxonomy, Term } from '@brisk/domain-core';
import { createPageGroup } from './create-page-group.use-case';
import { createPageGroupTranslation } from './create-page-group-translation.use-case';
import { publishPageTranslation } from './publish-page-translation.use-case';
import { listPublishedPagesForSitemap } from './list-published-pages-for-sitemap.use-case';
import {
  InMemoryPageGroupRepository,
  InMemoryPageGroupVersionRepository,
  InMemoryPageTranslationRepository,
  InMemoryPageTranslationVersionRepository,
  InMemoryReusableSectionRepository,
  InMemorySearchPort,
  InMemorySiteRepository,
  InMemoryTaxonomyRepository,
} from './in-memory-repositories.test-fixture';

describe('listPublishedPagesForSitemap', () => {
  const tenantId = 'tenant-1';

  function setup() {
    const pageGroupVersionRepository = new InMemoryPageGroupVersionRepository();
    const pageTranslationVersionRepository =
      new InMemoryPageTranslationVersionRepository();
    return {
      pageGroupRepository: new InMemoryPageGroupRepository(
        pageGroupVersionRepository,
      ),
      pageGroupVersionRepository,
      pageTranslationRepository: new InMemoryPageTranslationRepository(
        pageTranslationVersionRepository,
      ),
      taxonomyRepository: new InMemoryTaxonomyRepository(),
      pageTranslationVersionRepository,
      siteRepository: new InMemorySiteRepository(),
      searchPort: new InMemorySearchPort(),
      reusableSectionRepository: new InMemoryReusableSectionRepository(),
    };
  }

  async function seedSite(
    siteRepository: InMemorySiteRepository,
    overrides: Partial<Parameters<typeof Site.fromProps>[0]> = {},
  ) {
    const site = Site.fromProps({
      id: 'site-1',
      tenantId,
      name: 'Sito di prova',
      domain: 'example.com',
      themeName: 'classic',
      defaultLocale: 'it',
      enabledLocales: ['it'],
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
      ...overrides,
    });
    await siteRepository.save(site);
    return site;
  }

  async function createGroupAndTranslation(
    deps: ReturnType<typeof setup>,
    locale: string,
    slug: string,
    parentGroupId: string | null = null,
  ) {
    const group = await createPageGroup(deps, {
      tenantId,
      siteId: 'site-1',
      parentId: parentGroupId,
      createdBy: 'user-1',
    });
    const translation = await createPageGroupTranslation(deps, {
      tenantId,
      pageGroupId: group.id,
      locale,
      slug,
      seoMeta: { title: slug, description: '' },
      createdBy: 'user-1',
    });
    return { group, translation };
  }

  async function createAndPublish(
    deps: ReturnType<typeof setup>,
    slug: string,
  ) {
    const { group, translation } = await createGroupAndTranslation(
      deps,
      'it',
      slug,
    );
    await publishPageTranslation(deps, {
      tenantId,
      pageTranslationId: translation.id,
    });
    return group;
  }

  it('lists only published pages for the domain, skipping drafts', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    await createAndPublish(deps, 'chi-siamo');
    await createAndPublish(deps, 'contatti');
    await createGroupAndTranslation(deps, 'it', 'bozza');

    const result = await listPublishedPagesForSitemap(deps, {
      tenantId,
      domain: 'example.com',
    });

    expect(result?.items.map((entry) => entry.slug).sort()).toEqual([
      'chi-siamo',
      'contatti',
    ]);
  });

  async function seedTerm(
    deps: ReturnType<typeof setup>,
    options: {
      prefix: string | null;
      slugs: Record<string, string>;
      landingPageGroupId?: string;
    },
  ) {
    const taxonomy = Taxonomy.create({
      id: 'taxonomy-1',
      tenantId,
      siteId: 'site-1',
      prefix: options.prefix,
      name: { it: 'Categoria' },
    });
    await deps.taxonomyRepository.saveTaxonomy(taxonomy);
    const term = Term.create({
      id: 'term-1',
      tenantId,
      siteId: 'site-1',
      taxonomyId: taxonomy.id,
      name: { it: 'Espresso' },
      slugs: options.slugs,
    });
    if (options.landingPageGroupId) {
      term.setLandingPage(options.landingPageGroupId);
    }
    await deps.taxonomyRepository.saveTerm(term);
    return term;
  }

  /*
   * A term is an address a crawler should know about — that is the whole
   * argument for giving terms automatic routes (docs/adr/0064): a term
   * with no URL does not exist for a search engine.
   */
  it('lists a term at its own address, grouped by the term for hreflang', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository, { enabledLocales: ['it', 'en'] });
    await seedTerm(deps, {
      prefix: 'categoria',
      slugs: { it: 'espresso', en: 'espresso-machines' },
    });

    const result = await listPublishedPagesForSitemap(deps, {
      tenantId,
      domain: 'example.com',
    });

    expect(result?.items).toEqual([
      {
        slug: 'espresso',
        locale: 'it',
        groupId: 'term-1',
        ancestorSlugs: ['categoria'],
        updatedAt: expect.any(Date),
      },
      {
        slug: 'espresso-machines',
        locale: 'en',
        groupId: 'term-1',
        ancestorSlugs: ['categoria'],
        updatedAt: expect.any(Date),
      },
    ]);
  });

  it('leaves out a language the term does not answer in', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository, { enabledLocales: ['it', 'en'] });
    await seedTerm(deps, { prefix: null, slugs: { it: 'espresso' } });

    const result = await listPublishedPagesForSitemap(deps, {
      tenantId,
      domain: 'example.com',
    });

    expect(result?.items).toEqual([
      {
        slug: 'espresso',
        locale: 'it',
        groupId: 'term-1',
        // Mounted at the site root, so nothing in front of the slug.
        ancestorSlugs: [],
        updatedAt: expect.any(Date),
      },
    ]);
  });

  /*
   * The other half of the 301 (docs/adr/0067): the old URL redirects, so
   * listing it would hand a crawler exactly the duplicate the redirect
   * exists to remove.
   */
  it('drops a page a term renders on its own address', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    const kept = await createAndPublish(deps, 'contatti');
    const claimed = await createAndPublish(deps, 'chi-siamo');
    await seedTerm(deps, {
      prefix: 'categoria',
      slugs: { it: 'espresso' },
      landingPageGroupId: claimed.id,
    });

    const result = await listPublishedPagesForSitemap(deps, {
      tenantId,
      domain: 'example.com',
    });

    expect(result?.items.map((entry) => entry.slug).sort()).toEqual([
      'contatti',
      'espresso',
    ]);
    expect(result?.items.some((entry) => entry.groupId === kept.id)).toBe(true);
  });

  /*
   * The page still answers in a language the term does not reach — the
   * lookup keeps serving it there rather than redirecting into nothing
   * (docs/adr/0067) — so the sitemap must keep listing it there. Dropping
   * the whole group would hide a live URL.
   */
  it('keeps the claimed page listed in a language the term does not answer in', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository, { enabledLocales: ['it', 'en'] });
    const { group, translation } = await createGroupAndTranslation(
      deps,
      'it',
      'chi-siamo',
    );
    await publishPageTranslation(deps, {
      tenantId,
      pageTranslationId: translation.id,
    });
    const english = await createPageGroupTranslation(deps, {
      tenantId,
      pageGroupId: group.id,
      locale: 'en',
      slug: 'about-us',
      seoMeta: { title: 'About us', description: '' },
      createdBy: 'user-1',
    });
    await publishPageTranslation(deps, {
      tenantId,
      pageTranslationId: english.id,
    });
    // The term answers in Italian only.
    await seedTerm(deps, {
      prefix: 'categoria',
      slugs: { it: 'espresso' },
      landingPageGroupId: group.id,
    });

    const result = await listPublishedPagesForSitemap(deps, {
      tenantId,
      domain: 'example.com',
    });

    expect(
      result?.items.map((entry) => `${entry.locale}:${entry.slug}`).sort(),
    ).toEqual(['en:about-us', 'it:espresso']);
  });

  it('returns null when no site matches the domain', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    const result = await listPublishedPagesForSitemap(deps, {
      tenantId,
      domain: 'nobody-has-this.test',
    });

    expect(result).toBeNull();
  });

  it('returns an empty items array for a site with no published pages', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    const result = await listPublishedPagesForSitemap(deps, {
      tenantId,
      domain: 'example.com',
    });

    expect(result?.items).toEqual([]);
  });

  it("includes the site's search engine indexing flag", async () => {
    const deps = setup();
    await seedSite(deps.siteRepository, { searchEngineIndexingEnabled: true });

    const result = await listPublishedPagesForSitemap(deps, {
      tenantId,
      domain: 'example.com',
    });

    expect(result?.searchEngineIndexingEnabled).toBe(true);
  });

  it('resolves ancestorSlugs for a nested page, even through an unpublished ancestor', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    // "Servizi" stays a draft — its slug is still a structural fact for
    // "Idraulica"'s canonical URL, independent of whether Servizi itself
    // is published yet.
    const { group: servizi } = await createGroupAndTranslation(
      deps,
      'it',
      'servizi',
    );
    const { translation: idraulica } = await createGroupAndTranslation(
      deps,
      'it',
      'idraulica',
      servizi.id,
    );
    await publishPageTranslation(deps, {
      tenantId,
      pageTranslationId: idraulica.id,
    });

    const result = await listPublishedPagesForSitemap(deps, {
      tenantId,
      domain: 'example.com',
    });

    expect(result?.items).toEqual([
      expect.objectContaining({
        slug: 'idraulica',
        ancestorSlugs: ['servizi'],
      }),
    ]);
  });

  it('skips a published leaf whose ancestor has no translation in the same locale (not actually reachable at a real URL)', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository, { enabledLocales: ['it', 'en'] });
    // "Servizi" only has an 'it' translation — an 'en' leaf under it would
    // 404 walking down (resolvePageGroupByPath needs an 'en' slug at every
    // level), so it must not appear in the sitemap even though it is
    // itself marked published.
    const { group: servizi } = await createGroupAndTranslation(
      deps,
      'it',
      'servizi',
    );
    const { translation: idraulicaEn } = await createGroupAndTranslation(
      deps,
      'en',
      'plumbing',
      servizi.id,
    );
    await publishPageTranslation(deps, {
      tenantId,
      pageTranslationId: idraulicaEn.id,
    });

    const result = await listPublishedPagesForSitemap(deps, {
      tenantId,
      domain: 'example.com',
    });

    expect(result?.items).toEqual([]);
  });

  it("includes the site's default locale, and each entry's locale/groupId", async () => {
    const deps = setup();
    await seedSite(deps.siteRepository, { defaultLocale: 'en' });
    const group = await createAndPublish(deps, 'chi-siamo');

    const result = await listPublishedPagesForSitemap(deps, {
      tenantId,
      domain: 'example.com',
    });

    expect(result?.defaultLocale).toBe('en');
    expect(result?.items[0]).toMatchObject({
      slug: 'chi-siamo',
      locale: 'it',
      groupId: group.id,
    });
  });
});
