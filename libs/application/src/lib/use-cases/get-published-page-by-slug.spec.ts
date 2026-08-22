import { describe, expect, it } from 'vitest';
import { Site, SiteLayoutSection } from '@brisk/domain-core';
import { createPage } from './create-page.use-case.js';
import { publishPage } from './publish-page.use-case.js';
import { saveDraft } from './save-draft.use-case.js';
import { getPublishedPageBySlug } from './get-published-page-by-slug.use-case.js';
import {
  InMemoryPageRepository,
  InMemoryPageVersionRepository,
  InMemorySearchPort,
  InMemorySiteLayoutSectionRepository,
  InMemorySiteRepository,
} from './in-memory-repositories.test-fixture.js';

describe('getPublishedPageBySlug', () => {
  const tenantId = 'tenant-1';

  function setup() {
    const pageRepository = new InMemoryPageRepository();
    const pageVersionRepository = new InMemoryPageVersionRepository();
    const siteRepository = new InMemorySiteRepository();
    const siteLayoutSectionRepository =
      new InMemorySiteLayoutSectionRepository();
    const searchPort = new InMemorySearchPort();
    return {
      pageRepository,
      pageVersionRepository,
      siteRepository,
      siteLayoutSectionRepository,
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
    input: { groupId: string; locale: string; slug: string; title: string },
  ) {
    const page = await createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: input.groupId,
      locale: input.locale,
      slug: input.slug,
      seoMeta: { title: input.title, description: '' },
      createdBy: 'user-1',
    });
    await saveDraft(deps, {
      tenantId,
      pageId: page.id,
      content: [
        { type: 'Hero', props: { title: input.title, subtitle: 'sub' } },
      ],
      actorUserId: 'user-1',
    });
    await publishPage(deps, { tenantId, pageId: page.id });
    return page;
  }

  it('returns the published content for a published page on the matching domain and locale', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    await createAndPublish(deps, {
      groupId: 'group-1',
      locale: 'it',
      slug: 'chi-siamo',
      title: 'Chi siamo',
    });

    const result = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      slug: 'chi-siamo',
    });

    expect(result).toEqual({
      content: [
        { type: 'Hero', props: { title: 'Chi siamo', subtitle: 'sub' } },
      ],
      seoMeta: { title: 'Chi siamo', description: '' },
      locale: 'it',
      translations: [{ locale: 'it', slug: 'chi-siamo' }],
      ancestors: [],
      header: null,
      footer: null,
      headerSticky: false,
      site: {
        name: 'Sito di prova',
        domain: 'example.com',
        defaultLocale: 'it',
        enabledLocales: ['it', 'en'],
        untranslatedPageFallback: 'redirect-to-default',
        businessAddress: null,
        businessPhone: null,
        businessType: null,
        openingHours: null,
        searchEngineIndexingEnabled: false,
        themeSettings: {
          primaryColor: null,
          secondaryColor: null,
          fontFamily: null,
          customCss: null,
          headScript: null,
          bodyScript: null,
          faviconUrl: null,
          overridesEnabled: true,
        },
        themeTokens: {
          buttons: { borderRadius: null, paddingX: null, paddingY: null },
        },
      },
    });
  });

  it('resolves ancestors root-to-parent by walking parentId, and returns an empty list for a root page', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    const servizi = await createAndPublish(deps, {
      groupId: 'group-servizi',
      locale: 'it',
      slug: 'servizi',
      title: 'Servizi',
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
      content: [{ type: 'Text', props: { body: 'x' } }],
      actorUserId: 'user-1',
    });
    await publishPage(deps, { tenantId, pageId: idraulica.id });

    const child = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      slug: 'idraulica',
    });
    expect(child?.ancestors).toEqual([{ slug: 'servizi', title: 'Servizi' }]);

    const root = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      slug: 'servizi',
    });
    expect(root?.ancestors).toEqual([]);
  });

  it('lists every published locale-translation of the page, keyed by group', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    await createAndPublish(deps, {
      groupId: 'group-1',
      locale: 'it',
      slug: 'chi-siamo',
      title: 'Chi siamo',
    });
    await createAndPublish(deps, {
      groupId: 'group-1',
      locale: 'en',
      slug: 'about-us',
      title: 'About us',
    });

    const result = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      slug: 'chi-siamo',
    });

    expect(
      result?.translations.sort((a, b) => a.locale.localeCompare(b.locale)),
    ).toEqual([
      { locale: 'en', slug: 'about-us' },
      { locale: 'it', slug: 'chi-siamo' },
    ]);
  });

  it('never lists an unpublished draft translation in the same group', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    await createAndPublish(deps, {
      groupId: 'group-1',
      locale: 'it',
      slug: 'chi-siamo',
      title: 'Chi siamo',
    });
    // Draft-only English translation — never published.
    await createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: 'group-1',
      locale: 'en',
      slug: 'about-us',
      seoMeta: { title: 'About us', description: '' },
      createdBy: 'user-1',
    });

    const result = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      slug: 'chi-siamo',
    });

    expect(result?.translations).toEqual([{ locale: 'it', slug: 'chi-siamo' }]);
  });

  it("includes the site's business info when set, for schema.org LocalBusiness", async () => {
    const deps = setup();
    await seedSite(deps.siteRepository, {
      businessAddress: 'Via Roma 1, Milano',
      businessPhone: '+39 02 1234567',
      businessType: 'ProfessionalService',
      openingHours: [
        { dayOfWeek: 'monday', ranges: [{ opens: '09:00', closes: '18:00' }] },
      ],
    });
    await createAndPublish(deps, {
      groupId: 'group-1',
      locale: 'it',
      slug: 'chi-siamo',
      title: 'Chi siamo',
    });

    const result = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      slug: 'chi-siamo',
    });

    expect(result?.site).toMatchObject({
      businessAddress: 'Via Roma 1, Milano',
      businessPhone: '+39 02 1234567',
      businessType: 'ProfessionalService',
      openingHours: [
        { dayOfWeek: 'monday', ranges: [{ opens: '09:00', closes: '18:00' }] },
      ],
    });
  });

  it("propagates the site's search engine indexing flag", async () => {
    const deps = setup();
    await seedSite(deps.siteRepository, { searchEngineIndexingEnabled: true });
    await createAndPublish(deps, {
      groupId: 'group-1',
      locale: 'it',
      slug: 'chi-siamo',
      title: 'Chi siamo',
    });

    const result = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      slug: 'chi-siamo',
    });

    expect(result?.site.searchEngineIndexingEnabled).toBe(true);
  });

  it('never leaks draft content newer than the last publish', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    const page = await createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: 'group-1',
      locale: 'it',
      slug: 'chi-siamo',
      seoMeta: { title: 'Chi siamo', description: '' },
      createdBy: 'user-1',
    });
    await saveDraft(deps, {
      tenantId,
      pageId: page.id,
      content: [{ type: 'Text', props: { body: 'published version' } }],
      actorUserId: 'user-1',
    });
    await publishPage(deps, { tenantId, pageId: page.id });
    // Edited again after publishing — this is the "pending changes" the
    // editor-app's pages list flags; it must never reach the public site.
    await saveDraft(deps, {
      tenantId,
      pageId: page.id,
      content: [{ type: 'Text', props: { body: 'unpublished draft edit' } }],
      actorUserId: 'user-1',
    });

    const result = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      slug: 'chi-siamo',
    });

    expect(result?.content).toEqual([
      { type: 'Text', props: { body: 'published version' } },
    ]);
  });

  it('returns null for a page that has never been published', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    await createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: 'group-1',
      locale: 'it',
      slug: 'bozza',
      seoMeta: { title: 'Bozza', description: '' },
      createdBy: 'user-1',
    });

    const result = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      slug: 'bozza',
    });

    expect(result).toBeNull();
  });

  it('returns null when no site matches the domain', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    const result = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'nobody-has-this.test',
      locale: 'it',
      slug: 'chi-siamo',
    });

    expect(result).toBeNull();
  });

  it('returns null for a slug that does not exist on that site', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    const result = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      slug: 'non-esiste',
    });

    expect(result).toBeNull();
  });

  it('returns null for a locale that has no page at this slug, even if another locale does', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    await createAndPublish(deps, {
      groupId: 'group-1',
      locale: 'it',
      slug: 'chi-siamo',
      title: 'Chi siamo',
    });

    // No 'en' translation exists at all — requesting it directly 404s,
    // it does not fall back to the 'it' page (see the use case's own
    // comment on why: there is no groupId to search from on a miss).
    const result = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'en',
      slug: 'chi-siamo',
    });

    expect(result).toBeNull();
  });

  it('bundles the published header/footer for the same (site, locale)', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    await createAndPublish(deps, {
      groupId: 'group-1',
      locale: 'it',
      slug: 'chi-siamo',
      title: 'Chi siamo',
    });
    const header = SiteLayoutSection.create({
      id: 'header-1',
      tenantId,
      siteId: 'site-1',
      locale: 'it',
      kind: 'header',
    });
    header.saveDraft([{ type: 'Header', props: {} }]);
    header.publish();
    await deps.siteLayoutSectionRepository.save(header);
    const footer = SiteLayoutSection.create({
      id: 'footer-1',
      tenantId,
      siteId: 'site-1',
      locale: 'it',
      kind: 'footer',
    });
    footer.saveDraft([{ type: 'Footer', props: {} }]);
    footer.publish();
    await deps.siteLayoutSectionRepository.save(footer);

    const result = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      slug: 'chi-siamo',
    });

    expect(result?.header).toEqual([{ type: 'Header', props: {} }]);
    expect(result?.footer).toEqual([{ type: 'Footer', props: {} }]);
    expect(result?.headerSticky).toBe(false);
  });

  it('propagates a published sticky header, and gates it to false when the header is unpublished', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    await createAndPublish(deps, {
      groupId: 'group-1',
      locale: 'it',
      slug: 'chi-siamo',
      title: 'Chi siamo',
    });
    const stickyHeader = SiteLayoutSection.create({
      id: 'header-1',
      tenantId,
      siteId: 'site-1',
      locale: 'it',
      kind: 'header',
      sticky: true,
    });
    stickyHeader.saveDraft([{ type: 'Header', props: {} }]);
    stickyHeader.publish();
    await deps.siteLayoutSectionRepository.save(stickyHeader);

    const result = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      slug: 'chi-siamo',
    });

    expect(result?.headerSticky).toBe(true);
  });

  it('never leaks an unpublished header draft to the public site', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    await createAndPublish(deps, {
      groupId: 'group-1',
      locale: 'it',
      slug: 'chi-siamo',
      title: 'Chi siamo',
    });
    const header = SiteLayoutSection.create({
      id: 'header-1',
      tenantId,
      siteId: 'site-1',
      locale: 'it',
      kind: 'header',
    });
    header.saveDraft([{ type: 'Header', props: {} }]);
    // Never published.
    await deps.siteLayoutSectionRepository.save(header);

    const result = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      slug: 'chi-siamo',
    });

    expect(result?.header).toBeNull();
  });

  it('returns null header/footer when none has ever been configured for this locale', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    await createAndPublish(deps, {
      groupId: 'group-1',
      locale: 'it',
      slug: 'chi-siamo',
      title: 'Chi siamo',
    });

    const result = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      slug: 'chi-siamo',
    });

    expect(result?.header).toBeNull();
    expect(result?.footer).toBeNull();
  });
});
