import { describe, expect, it } from 'vitest';
import { DEFAULT_COOKIE_BANNER_SETTINGS } from '@brisk/shared-types';
import { Site } from '@brisk/domain-core';
import { createPageGroup } from './create-page-group.use-case';
import { createPageGroupTranslation } from './create-page-group-translation.use-case';
import { publishPageTranslation } from './publish-page-translation.use-case';
import { listPublishedPageTree } from './list-published-page-tree.use-case';
import {
  InMemoryPageGroupRepository,
  InMemoryPageGroupVersionRepository,
  InMemoryPageTranslationRepository,
  InMemoryPageTranslationVersionRepository,
  InMemorySearchPort,
  InMemorySiteRepository,
} from './in-memory-repositories.test-fixture';

describe('listPublishedPageTree', () => {
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

  async function seedSite(siteRepository: InMemorySiteRepository) {
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
      themeHeadScript: null,
      themeBodyScript: null,
      themeFaviconUrl: null,
      themeOverridesEnabled: true,
      themeAllowedTrackerDomains: [],
      formSubmissionRetentionDays: null,
      themeTrackerScripts: [],
      cookieBannerSettings: DEFAULT_COOKIE_BANNER_SETTINGS,
      createdAt: new Date(),
    });
    await siteRepository.save(site);
    return site;
  }

  async function createGroupAndTranslation(
    deps: ReturnType<typeof setup>,
    locale: string,
    slug: string,
    title: string,
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
      seoMeta: { title, description: '' },
      createdBy: 'user-1',
    });
    return { group, translation };
  }

  async function createAndPublish(
    deps: ReturnType<typeof setup>,
    slug: string,
    title: string,
    parentGroupId: string | null = null,
  ) {
    const { group, translation } = await createGroupAndTranslation(
      deps,
      'it',
      slug,
      title,
      parentGroupId,
    );
    await publishPageTranslation(deps, {
      tenantId,
      pageTranslationId: translation.id,
    });
    return group;
  }

  it('lists only published pages for the domain and locale, with title/parentId', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    const guide = await createAndPublish(deps, 'guide', 'Guide');
    await createAndPublish(deps, 'installazione', 'Installazione', guide.id);
    await createGroupAndTranslation(deps, 'it', 'bozza', 'Bozza');

    const result = await listPublishedPageTree(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
    });

    expect(result?.map((node) => node.slug).sort()).toEqual([
      'guide',
      'installazione',
    ]);
    const installazione = result?.find((node) => node.slug === 'installazione');
    expect(installazione).toMatchObject({
      title: 'Installazione',
      parentId: guide.id,
      ancestorSlugs: ['guide'],
    });
  });

  it('returns null when no site matches the domain', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    const result = await listPublishedPageTree(deps, {
      tenantId,
      domain: 'nobody-has-this.test',
      locale: 'it',
    });

    expect(result).toBeNull();
  });

  it('treats a page under an unpublished parent as unlinkable (parentId null), but keeps its structural ancestorSlugs', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    // "Bozza parent" stays a draft — its slug is still a structural fact
    // for "Figlia"'s ancestry (same reasoning as the sitemap use case's own
    // "even through an unpublished ancestor" test), but there's no
    // published page for a sidebar to actually link/nest it under.
    const { group: draftParent } = await createGroupAndTranslation(
      deps,
      'it',
      'bozza-parent',
      'Bozza parent',
    );
    await createAndPublish(deps, 'figlia', 'Figlia', draftParent.id);

    const result = await listPublishedPageTree(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
    });

    expect(result).toEqual([
      expect.objectContaining({
        slug: 'figlia',
        parentId: null,
        ancestorSlugs: ['bozza-parent'],
      }),
    ]);
  });

  it('filters by locale, ignoring pages published in another locale', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    const { translation } = await createGroupAndTranslation(
      deps,
      'en',
      'guide-en',
      'Guide EN',
    );
    await publishPageTranslation(deps, {
      tenantId,
      pageTranslationId: translation.id,
    });

    const result = await listPublishedPageTree(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
    });

    expect(result).toEqual([]);
  });
});
