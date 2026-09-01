import { describe, expect, it } from 'vitest';
import { DEFAULT_COOKIE_BANNER_SETTINGS } from '@brisk/shared-types';
import { Site } from '@brisk/domain-core';
import { createPageGroup } from './create-page-group.use-case';
import { createPageGroupTranslation } from './create-page-group-translation.use-case';
import { publishPageTranslation } from './publish-page-translation.use-case';
import { listPublishedPagesForSitemap } from './list-published-pages-for-sitemap.use-case';
import {
  InMemoryPageGroupRepository,
  InMemoryPageGroupVersionRepository,
  InMemoryPageTranslationRepository,
  InMemoryPageTranslationVersionRepository,
  InMemorySearchPort,
  InMemorySiteRepository,
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
      pageTranslationVersionRepository,
      siteRepository: new InMemorySiteRepository(),
      searchPort: new InMemorySearchPort(),
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
