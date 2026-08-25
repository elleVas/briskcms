import { describe, expect, it } from 'vitest';
import { Site } from '@brisk/domain-core';
import { createPage } from './create-page.use-case.js';
import { publishPage } from './publish-page.use-case.js';
import { saveDraft } from './save-draft.use-case.js';
import { listPublishedPageTree } from './list-published-page-tree.use-case.js';
import {
  InMemoryPageRepository,
  InMemoryPageVersionRepository,
  InMemorySearchPort,
  InMemorySiteRepository,
} from './in-memory-repositories.test-fixture.js';

describe('listPublishedPageTree', () => {
  const tenantId = 'tenant-1';

  function setup() {
    return {
      pageRepository: new InMemoryPageRepository(),
      pageVersionRepository: new InMemoryPageVersionRepository(),
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
      createdAt: new Date(),
    });
    await siteRepository.save(site);
    return site;
  }

  async function createAndPublish(
    deps: ReturnType<typeof setup>,
    slug: string,
    title: string,
    parentId: string | null = null,
  ) {
    const page = await createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: `group-${slug}`,
      locale: 'it',
      slug,
      parentId,
      seoMeta: { title, description: '' },
      createdBy: 'user-1',
    });
    await saveDraft(deps, {
      tenantId,
      pageId: page.id,
      content: [],
      actorUserId: 'user-1',
    });
    await publishPage(deps, { tenantId, pageId: page.id });
    return page;
  }

  it('lists only published pages for the domain and locale, with title/parentId', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    const guide = await createAndPublish(deps, 'guide', 'Guide');
    await createAndPublish(deps, 'installazione', 'Installazione', guide.id);
    await createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: 'group-bozza',
      locale: 'it',
      slug: 'bozza',
      seoMeta: { title: 'Bozza', description: '' },
      createdBy: 'user-1',
    });

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
    const draftParent = await createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: 'group-bozza-parent',
      locale: 'it',
      slug: 'bozza-parent',
      seoMeta: { title: 'Bozza parent', description: '' },
      createdBy: 'user-1',
    });
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
    const page = await createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: 'group-en',
      locale: 'en',
      slug: 'guide-en',
      seoMeta: { title: 'Guide EN', description: '' },
      createdBy: 'user-1',
    });
    await saveDraft(deps, {
      tenantId,
      pageId: page.id,
      content: [],
      actorUserId: 'user-1',
    });
    await publishPage(deps, { tenantId, pageId: page.id });

    const result = await listPublishedPageTree(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
    });

    expect(result).toEqual([]);
  });
});
