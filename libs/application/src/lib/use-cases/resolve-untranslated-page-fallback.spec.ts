import { describe, expect, it } from 'vitest';
import { Site } from '@brisk/domain-core';
import { createPage } from './create-page.use-case.js';
import { publishPage } from './publish-page.use-case.js';
import { saveDraft } from './save-draft.use-case.js';
import { resolveUntranslatedPageFallback } from './resolve-untranslated-page-fallback.use-case.js';
import {
  InMemoryPageRepository,
  InMemoryPageVersionRepository,
  InMemorySearchPort,
  InMemorySiteRepository,
} from './in-memory-repositories.test-fixture.js';

describe('resolveUntranslatedPageFallback', () => {
  const tenantId = 'tenant-1';

  function setup() {
    const pageVersionRepository = new InMemoryPageVersionRepository();
    const pageRepository = new InMemoryPageRepository(pageVersionRepository);
    const siteRepository = new InMemorySiteRepository();
    const searchPort = new InMemorySearchPort();
    return { pageRepository, siteRepository, searchPort };
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

  it("falls back to the default-locale page with the same slug when the requested locale has none, and the site is set to 'redirect-to-default'", async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    await createAndPublish(deps, {
      groupId: 'group-1',
      locale: 'it',
      slug: 'chi-siamo',
      title: 'Chi siamo',
    });

    const result = await resolveUntranslatedPageFallback(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'en',
      slug: 'chi-siamo',
    });

    expect(result).toEqual({ locale: 'it', slug: 'chi-siamo' });
  });

  it("returns null when the site is set to 'not-available'", async () => {
    const deps = setup();
    await seedSite(deps.siteRepository, {
      untranslatedPageFallback: 'not-available',
    });
    await createAndPublish(deps, {
      groupId: 'group-1',
      locale: 'it',
      slug: 'chi-siamo',
      title: 'Chi siamo',
    });

    const result = await resolveUntranslatedPageFallback(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'en',
      slug: 'chi-siamo',
    });

    expect(result).toBeNull();
  });

  it('returns null when the default-locale page with that slug does not exist either', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    const result = await resolveUntranslatedPageFallback(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'en',
      slug: 'nobody-home',
    });

    expect(result).toBeNull();
  });

  it('returns null when the default-locale page with that slug exists but is only a draft', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    await createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: 'group-1',
      locale: 'it',
      slug: 'chi-siamo',
      seoMeta: { title: 'Chi siamo', description: '' },
      createdBy: 'user-1',
    });

    const result = await resolveUntranslatedPageFallback(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'en',
      slug: 'chi-siamo',
    });

    expect(result).toBeNull();
  });

  it('returns null when the requested locale already IS the default locale — nothing more "default" to fall back to', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    const result = await resolveUntranslatedPageFallback(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      slug: 'chi-siamo',
    });

    expect(result).toBeNull();
  });

  it('returns null when the domain does not resolve to any site', async () => {
    const deps = setup();

    const result = await resolveUntranslatedPageFallback(deps, {
      tenantId,
      domain: 'nobody.example',
      locale: 'en',
      slug: 'chi-siamo',
    });

    expect(result).toBeNull();
  });
});
