import { describe, expect, it } from 'vitest';
import { Site } from '@brisk/domain-core';
import { createPage } from './create-page.use-case.js';
import { publishPage } from './publish-page.use-case.js';
import { saveDraft } from './save-draft.use-case.js';
import { listPublishedPagesForSitemap } from './list-published-pages-for-sitemap.use-case.js';
import {
  InMemoryPageRepository,
  InMemoryPageVersionRepository,
  InMemorySiteRepository,
} from './in-memory-repositories.test-fixture.js';

describe('listPublishedPagesForSitemap', () => {
  const tenantId = 'tenant-1';

  function setup() {
    const pageRepository = new InMemoryPageRepository();
    const pageVersionRepository = new InMemoryPageVersionRepository();
    const siteRepository = new InMemorySiteRepository();
    return { pageRepository, pageVersionRepository, siteRepository };
  }

  async function seedSite(siteRepository: InMemorySiteRepository) {
    const site = Site.fromProps({
      id: 'site-1',
      tenantId,
      name: 'Sito di prova',
      domain: 'example.com',
      defaultLocale: 'it',
      enabledLocales: ['it'],
      businessAddress: null,
      businessPhone: null,
      businessType: null,
      openingHours: null,
      createdAt: new Date(),
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

  it('lists only published pages for the domain', async () => {
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

    expect(result?.map((entry) => entry.slug).sort()).toEqual([
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
});
