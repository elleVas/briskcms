import { describe, expect, it } from 'vitest';
import { Site } from '@brisk/domain-core';
import { createPage } from './create-page.use-case.js';
import { publishPage } from './publish-page.use-case.js';
import { saveDraft } from './save-draft.use-case.js';
import { listPublishedPagesForSitemap } from './list-published-pages-for-sitemap.use-case.js';
import {
  InMemoryPageRepository,
  InMemoryPageVersionRepository,
  InMemorySearchPort,
  InMemorySiteRepository,
} from './in-memory-repositories.test-fixture.js';

describe('listPublishedPagesForSitemap', () => {
  const tenantId = 'tenant-1';

  function setup() {
    const pageRepository = new InMemoryPageRepository();
    const pageVersionRepository = new InMemoryPageVersionRepository();
    const siteRepository = new InMemorySiteRepository();
    const searchPort = new InMemorySearchPort();
    return {
      pageRepository,
      pageVersionRepository,
      siteRepository,
      searchPort,
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
      themeTokens: null,
      createdAt: new Date(),
      ...overrides,
    });
    await siteRepository.save(site);
    return site;
  }

  async function createAndPublish(
    deps: ReturnType<typeof setup>,
    slug: string,
  ) {
    const page = await createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: `group-${slug}`,
      locale: 'it',
      slug,
      seoMeta: { title: slug, description: '' },
      createdBy: 'user-1',
    });
    await saveDraft(deps, {
      tenantId,
      pageId: page.id,
      content: [],
      actorUserId: 'user-1',
    });
    await publishPage(deps, { tenantId, pageId: page.id });
  }

  it('lists only published pages for the domain, skipping drafts', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    await createAndPublish(deps, 'chi-siamo');
    await createAndPublish(deps, 'contatti');
    await createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: 'group-bozza',
      locale: 'it',
      slug: 'bozza',
      seoMeta: { title: 'Bozza', description: '' },
      createdBy: 'user-1',
    });

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
    const servizi = await createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: 'group-servizi',
      locale: 'it',
      slug: 'servizi',
      seoMeta: { title: 'Servizi', description: '' },
      createdBy: 'user-1',
    });
    const idraulica = await createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: 'group-idraulica',
      locale: 'it',
      slug: 'idraulica',
      parentId: servizi.id,
      seoMeta: { title: 'Idraulica', description: '' },
      createdBy: 'user-1',
    });
    await saveDraft(deps, {
      tenantId,
      pageId: idraulica.id,
      content: [],
      actorUserId: 'user-1',
    });
    await publishPage(deps, { tenantId, pageId: idraulica.id });

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

  it("includes the site's default locale, and each entry's locale/groupId", async () => {
    const deps = setup();
    await seedSite(deps.siteRepository, { defaultLocale: 'en' });
    await createAndPublish(deps, 'chi-siamo');

    const result = await listPublishedPagesForSitemap(deps, {
      tenantId,
      domain: 'example.com',
    });

    expect(result?.defaultLocale).toBe('en');
    expect(result?.items[0]).toMatchObject({
      slug: 'chi-siamo',
      locale: 'it',
      groupId: 'group-chi-siamo',
    });
  });
});
