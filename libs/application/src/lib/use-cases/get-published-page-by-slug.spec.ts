import { describe, expect, it } from 'vitest';
import { DEFAULT_COOKIE_BANNER_SETTINGS } from '@brisk/shared-types';
import { Site, SiteLayoutSection, type PageGroup } from '@brisk/domain-core';
import { createPageGroup } from './create-page-group.use-case';
import { createPageGroupTranslation } from './create-page-group-translation.use-case';
import { publishPageTranslation } from './publish-page-translation.use-case';
import { savePageGroupContent } from './save-page-group-content.use-case';
import { getPublishedPageBySlug } from './get-published-page-by-slug.use-case';
import {
  InMemoryPageGroupRepository,
  InMemoryPageGroupVersionRepository,
  InMemoryPageTranslationRepository,
  InMemoryPageTranslationVersionRepository,
  InMemorySearchPort,
  InMemorySiteLayoutSectionRepository,
  InMemorySiteRepository,
  InMemorySiteThemeBlockStylesRepository,
} from './in-memory-repositories.test-fixture';

describe('getPublishedPageBySlug', () => {
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
      siteLayoutSectionRepository: new InMemorySiteLayoutSectionRepository(),
      siteThemeBlockStylesRepository:
        new InMemorySiteThemeBlockStylesRepository(),
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

  async function createGroupAndPublish(
    deps: ReturnType<typeof setup>,
    input: {
      locale: string;
      slug: string;
      title: string;
      parentGroupId?: string | null;
    },
  ) {
    const group = await createPageGroup(deps, {
      tenantId,
      siteId: 'site-1',
      parentId: input.parentGroupId ?? null,
      content: [
        { type: 'Hero', props: { title: input.title, subtitle: 'sub' } },
      ],
      createdBy: 'user-1',
    });
    const translation = await publishTranslationInGroup(deps, group, input);
    return { group, translation };
  }

  async function publishTranslationInGroup(
    deps: ReturnType<typeof setup>,
    group: PageGroup,
    input: { locale: string; slug: string; title: string },
  ) {
    const translation = await createPageGroupTranslation(deps, {
      tenantId,
      pageGroupId: group.id,
      locale: input.locale,
      slug: input.slug,
      seoMeta: { title: input.title, description: '' },
      createdBy: 'user-1',
    });
    return publishPageTranslation(deps, {
      tenantId,
      pageTranslationId: translation.id,
    });
  }

  it('returns the published content for a published page on the matching domain and locale', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    await createGroupAndPublish(deps, {
      locale: 'it',
      slug: 'chi-siamo',
      title: 'Chi siamo',
    });

    const result = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      segments: ['chi-siamo'],
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
        themeName: 'classic',
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
          allowedTrackerDomains: [],
          trackerScripts: [],
        },
        themeTokens: {
          blockStyles: {},
        },
        cookieBannerSettings: DEFAULT_COOKIE_BANNER_SETTINGS,
        privacyPolicySlug: null,
        cookiePolicySlug: null,
      },
    });
  });

  it('resolves a nested page by its full path and returns its ancestors root-to-parent, empty for a root page', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    const { group: servizi } = await createGroupAndPublish(deps, {
      locale: 'it',
      slug: 'servizi',
      title: 'Servizi',
    });
    const idraulicaGroup = await createPageGroup(deps, {
      tenantId,
      siteId: 'site-1',
      parentId: servizi.id,
      content: [{ type: 'Text', props: { body: 'x' } }],
      createdBy: 'user-1',
    });
    await publishTranslationInGroup(deps, idraulicaGroup, {
      locale: 'it',
      slug: 'idraulica',
      title: 'Idraulica',
    });

    const child = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      segments: ['servizi', 'idraulica'],
    });
    expect(child?.ancestors).toEqual([{ slug: 'servizi', title: 'Servizi' }]);

    const root = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      segments: ['servizi'],
    });
    expect(root?.ancestors).toEqual([]);
  });

  it('disambiguates two pages sharing the same trailing slug under different parents', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    const { group: branchA } = await createGroupAndPublish(deps, {
      locale: 'it',
      slug: 'ramo-a',
      title: 'Ramo A',
    });
    const { group: branchB } = await createGroupAndPublish(deps, {
      locale: 'it',
      slug: 'ramo-b',
      title: 'Ramo B',
    });
    const childOfAGroup = await createPageGroup(deps, {
      tenantId,
      siteId: 'site-1',
      parentId: branchA.id,
      content: [{ type: 'Text', props: { body: 'A' } }],
      createdBy: 'user-1',
    });
    await publishTranslationInGroup(deps, childOfAGroup, {
      locale: 'it',
      slug: 'dettagli',
      title: 'Dettagli A',
    });
    const childOfBGroup = await createPageGroup(deps, {
      tenantId,
      siteId: 'site-1',
      parentId: branchB.id,
      content: [{ type: 'Text', props: { body: 'B' } }],
      createdBy: 'user-1',
    });
    await publishTranslationInGroup(deps, childOfBGroup, {
      locale: 'it',
      slug: 'dettagli',
      title: 'Dettagli B',
    });

    const foundUnderA = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      segments: ['ramo-a', 'dettagli'],
    });
    expect(foundUnderA?.content).toEqual([
      { type: 'Text', props: { body: 'A' } },
    ]);

    const foundUnderB = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      segments: ['ramo-b', 'dettagli'],
    });
    expect(foundUnderB?.content).toEqual([
      { type: 'Text', props: { body: 'B' } },
    ]);

    // The trailing slug alone is ambiguous now — a mismatched leading
    // segment must not accidentally match the OTHER branch's page.
    const wrongBranch = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      segments: ['ramo-does-not-exist', 'dettagli'],
    });
    expect(wrongBranch).toBeNull();
  });

  it('lists every published locale-translation of the page, keyed by group', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    const { group } = await createGroupAndPublish(deps, {
      locale: 'it',
      slug: 'chi-siamo',
      title: 'Chi siamo',
    });
    await publishTranslationInGroup(deps, group, {
      locale: 'en',
      slug: 'about-us',
      title: 'About us',
    });

    const result = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      segments: ['chi-siamo'],
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
    const { group } = await createGroupAndPublish(deps, {
      locale: 'it',
      slug: 'chi-siamo',
      title: 'Chi siamo',
    });
    // Draft-only English translation — never published.
    await createPageGroupTranslation(deps, {
      tenantId,
      pageGroupId: group.id,
      locale: 'en',
      slug: 'about-us',
      seoMeta: { title: 'About us', description: '' },
      createdBy: 'user-1',
    });

    const result = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      segments: ['chi-siamo'],
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
    await createGroupAndPublish(deps, {
      locale: 'it',
      slug: 'chi-siamo',
      title: 'Chi siamo',
    });

    const result = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      segments: ['chi-siamo'],
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
    await createGroupAndPublish(deps, {
      locale: 'it',
      slug: 'chi-siamo',
      title: 'Chi siamo',
    });

    const result = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      segments: ['chi-siamo'],
    });

    expect(result?.site.searchEngineIndexingEnabled).toBe(true);
  });

  it('never leaks draft content newer than the last publish', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    const group = await createPageGroup(deps, {
      tenantId,
      siteId: 'site-1',
      content: [{ type: 'Text', props: { body: 'published version' } }],
      createdBy: 'user-1',
    });
    await publishTranslationInGroup(deps, group, {
      locale: 'it',
      slug: 'chi-siamo',
      title: 'Chi siamo',
    });
    // The group's draft structure is edited again after publishing — this
    // must never reach the public site: getPublishedPageBySlug always
    // reads the translation's frozen publishedSnapshot, never a live
    // merge of PageGroup.content (see the use case's own comment).
    await savePageGroupContent(deps, {
      tenantId,
      pageGroupId: group.id,
      content: [{ type: 'Text', props: { body: 'unpublished draft edit' } }],
      actorUserId: 'user-1',
    });

    const result = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      segments: ['chi-siamo'],
    });

    expect(result?.content).toEqual([
      { type: 'Text', props: { body: 'published version' } },
    ]);
  });

  it("resolves a NavLink's page reference to the CURRENT locale's own path, not whichever locale it was picked in", async () => {
    // Real bug, found live: `page` isn't a translatable field, so a
    // locale-specific slug baked in at pick time (the old pickedPageSchema
    // shape) got reused verbatim for every locale — an IT reader could get
    // an EN link. `page` is now locale-independent ({pageGroupId, title})
    // and resolved fresh for whichever locale is actually being rendered.
    const deps = setup();
    await seedSite(deps.siteRepository);
    const { group: docsGroup } = await createGroupAndPublish(deps, {
      locale: 'it',
      slug: 'documentazione',
      title: 'Documentazione',
    });
    await publishTranslationInGroup(deps, docsGroup, {
      locale: 'en',
      slug: 'docs',
      title: 'Docs',
    });
    const homeGroup = await createPageGroup(deps, {
      tenantId,
      siteId: 'site-1',
      content: [
        {
          id: 'nav-1',
          type: 'NavLink',
          props: {
            label: 'Docs',
            linkType: 'page',
            page: { pageGroupId: docsGroup.id, title: 'Documentazione' },
            url: '',
          },
        },
      ],
      createdBy: 'user-1',
    });
    await publishTranslationInGroup(deps, homeGroup, {
      locale: 'it',
      slug: 'home',
      title: 'Home',
    });
    await publishTranslationInGroup(deps, homeGroup, {
      locale: 'en',
      slug: 'home-en',
      title: 'Home',
    });

    const it = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      segments: ['home'],
    });
    const en = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'en',
      segments: ['home-en'],
    });

    expect(it?.content[0].props['page']).toMatchObject({
      locale: 'it',
      slug: 'documentazione',
    });
    expect(en?.content[0].props['page']).toMatchObject({
      locale: 'en',
      slug: 'docs',
    });
  });

  it('returns null for a page that has never been published', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    const group = await createPageGroup(deps, {
      tenantId,
      siteId: 'site-1',
      createdBy: 'user-1',
    });
    await createPageGroupTranslation(deps, {
      tenantId,
      pageGroupId: group.id,
      locale: 'it',
      slug: 'bozza',
      seoMeta: { title: 'Bozza', description: '' },
      createdBy: 'user-1',
    });

    const result = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      segments: ['bozza'],
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
      segments: ['chi-siamo'],
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
      segments: ['non-esiste'],
    });

    expect(result).toBeNull();
  });

  it('returns null for a locale that has no page at this slug, even if another locale does', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    await createGroupAndPublish(deps, {
      locale: 'it',
      slug: 'chi-siamo',
      title: 'Chi siamo',
    });

    // No 'en' translation exists at all — requesting it directly 404s,
    // it does not fall back to the 'it' page (see the use case's own
    // comment on why: this is deliberate here, resolveUntranslatedPageFallback
    // is the caller's job).
    const result = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'en',
      segments: ['chi-siamo'],
    });

    expect(result).toBeNull();
  });

  it('bundles the published header/footer for the same (site, locale)', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    await createGroupAndPublish(deps, {
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
      segments: ['chi-siamo'],
    });

    expect(result?.header).toEqual([{ type: 'Header', props: {} }]);
    expect(result?.footer).toEqual([{ type: 'Footer', props: {} }]);
    expect(result?.headerSticky).toBe(false);
  });

  it('propagates a published sticky header, and gates it to false when the header is unpublished', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    await createGroupAndPublish(deps, {
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
      segments: ['chi-siamo'],
    });

    expect(result?.headerSticky).toBe(true);
  });

  it('never leaks an unpublished header draft to the public site', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    await createGroupAndPublish(deps, {
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
      segments: ['chi-siamo'],
    });

    expect(result?.header).toBeNull();
  });

  it('returns null header/footer when none has ever been configured for this locale', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    await createGroupAndPublish(deps, {
      locale: 'it',
      slug: 'chi-siamo',
      title: 'Chi siamo',
    });

    const result = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      segments: ['chi-siamo'],
    });

    expect(result?.header).toBeNull();
    expect(result?.footer).toBeNull();
  });
});
