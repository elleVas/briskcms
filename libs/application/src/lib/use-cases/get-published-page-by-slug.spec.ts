import { describe, expect, it } from 'vitest';
import { Site } from '@brisk/domain-core';
import { createPage } from './create-page.use-case.js';
import { publishPage } from './publish-page.use-case.js';
import { saveDraft } from './save-draft.use-case.js';
import { getPublishedPageBySlug } from './get-published-page-by-slug.use-case.js';
import {
  InMemoryPageRepository,
  InMemoryPageVersionRepository,
  InMemorySiteRepository,
} from './in-memory-repositories.test-fixture.js';

describe('getPublishedPageBySlug', () => {
  const tenantId = 'tenant-1';

  function setup() {
    const pageRepository = new InMemoryPageRepository();
    const pageVersionRepository = new InMemoryPageVersionRepository();
    const siteRepository = new InMemorySiteRepository();
    return { pageRepository, pageVersionRepository, siteRepository };
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
      businessAddress: null,
      businessPhone: null,
      businessType: null,
      openingHours: null,
      createdAt: new Date(),
      ...overrides,
    });
    await siteRepository.save(site);
    return site;
  }

  it('returns the published content for a published page on the matching domain', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    const page = await createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: 'group-1',
      locale: 'it',
      slug: 'chi-siamo',
      seoMeta: { title: 'Chi siamo', description: 'La nostra storia' },
      createdBy: 'user-1',
    });
    await saveDraft(deps, {
      tenantId,
      pageId: page.id,
      content: [{ type: 'Hero', props: { title: 'v1', subtitle: 'sub' } }],
      actorUserId: 'user-1',
    });
    await publishPage(deps, { tenantId, pageId: page.id });

    const result = await getPublishedPageBySlug(deps, {
      tenantId,
      domain: 'example.com',
      slug: 'chi-siamo',
    });

    expect(result).toEqual({
      content: [{ type: 'Hero', props: { title: 'v1', subtitle: 'sub' } }],
      seoMeta: { title: 'Chi siamo', description: 'La nostra storia' },
      locale: 'it',
    });
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
      slug: 'non-esiste',
    });

    expect(result).toBeNull();
  });
});
