import { describe, expect, it } from 'vitest';
import { Site, SiteLayoutSection } from '@brisk/domain-core';
import { createPage } from './create-page.use-case.js';
import { saveDraft } from './save-draft.use-case.js';
import { publishPage } from './publish-page.use-case.js';
import { getPreviewPageById } from './get-preview-page-by-id.use-case.js';
import {
  InMemoryPageRepository,
  InMemoryPageVersionRepository,
  InMemoryPreviewTokenPort,
  InMemorySearchPort,
  InMemorySiteLayoutSectionRepository,
  InMemorySiteRepository,
  InMemorySiteThemeBlockStylesRepository,
} from './in-memory-repositories.test-fixture.js';

describe('getPreviewPageById', () => {
  const tenantId = 'tenant-1';

  function setup() {
    const pageRepository = new InMemoryPageRepository();
    const pageVersionRepository = new InMemoryPageVersionRepository();
    const siteRepository = new InMemorySiteRepository();
    const siteLayoutSectionRepository =
      new InMemorySiteLayoutSectionRepository();
    const siteThemeBlockStylesRepository =
      new InMemorySiteThemeBlockStylesRepository();
    const searchPort = new InMemorySearchPort();
    const previewTokenPort = new InMemoryPreviewTokenPort();
    return {
      pageRepository,
      pageVersionRepository,
      siteRepository,
      siteLayoutSectionRepository,
      siteThemeBlockStylesRepository,
      searchPort,
      previewTokenPort,
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
      themeAllowedTrackerDomains: [],
      createdAt: new Date(),
    });
    await siteRepository.save(site);
    return site;
  }

  it('returns the draft content behind a valid token, even for a never-published page', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    const page = await createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: 'group-1',
      locale: 'it',
      slug: 'bozza',
      seoMeta: { title: 'Bozza', description: '' },
      createdBy: 'user-1',
    });
    await saveDraft(deps, {
      tenantId,
      pageId: page.id,
      content: [{ type: 'Hero', props: { title: 'In lavorazione' } }],
      actorUserId: 'user-1',
    });
    const { token } = await deps.previewTokenPort.createToken(
      tenantId,
      'page',
      page.id,
      60_000,
    );

    const result = await getPreviewPageById(deps, {
      tenantId,
      pageId: page.id,
      token,
    });

    expect(result?.content).toEqual([
      { type: 'Hero', props: { title: 'In lavorazione' } },
    ]);
  });

  it('shows unpublished draft edits made after the last publish', async () => {
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
    await saveDraft(deps, {
      tenantId,
      pageId: page.id,
      content: [{ type: 'Text', props: { body: 'unpublished draft edit' } }],
      actorUserId: 'user-1',
    });
    const { token } = await deps.previewTokenPort.createToken(
      tenantId,
      'page',
      page.id,
      60_000,
    );

    const result = await getPreviewPageById(deps, {
      tenantId,
      pageId: page.id,
      token,
    });

    expect(result?.content).toEqual([
      { type: 'Text', props: { body: 'unpublished draft edit' } },
    ]);
  });

  it('shows the real draft of header/footer, not just what is published', async () => {
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
    const header = SiteLayoutSection.create({
      id: 'header-1',
      tenantId,
      siteId: 'site-1',
      locale: 'it',
      kind: 'header',
    });
    header.saveDraft([{ type: 'Header', props: { label: 'draft header' } }]);
    // Never published.
    await deps.siteLayoutSectionRepository.save(header);
    const { token } = await deps.previewTokenPort.createToken(
      tenantId,
      'page',
      page.id,
      60_000,
    );

    const result = await getPreviewPageById(deps, {
      tenantId,
      pageId: page.id,
      token,
    });

    expect(result?.header).toEqual([
      { type: 'Header', props: { label: 'draft header' } },
    ]);
  });

  it('returns null for a missing/expired/mismatched token', async () => {
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

    expect(
      await getPreviewPageById(deps, {
        tenantId,
        pageId: page.id,
        token: 'not-a-real-token',
      }),
    ).toBeNull();
  });

  it('returns null when the token belongs to a different page', async () => {
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
    const { token } = await deps.previewTokenPort.createToken(
      tenantId,
      'page',
      'another-page-id',
      60_000,
    );

    expect(
      await getPreviewPageById(deps, { tenantId, pageId: page.id, token }),
    ).toBeNull();
  });

  it('returns null for a token belonging to a different tenant', async () => {
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
    const { token } = await deps.previewTokenPort.createToken(
      'another-tenant',
      'page',
      page.id,
      60_000,
    );

    expect(
      await getPreviewPageById(deps, { tenantId, pageId: page.id, token }),
    ).toBeNull();
  });

  it('returns null for an id that does not exist', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    const { token } = await deps.previewTokenPort.createToken(
      tenantId,
      'page',
      'ghost-page',
      60_000,
    );

    expect(
      await getPreviewPageById(deps, {
        tenantId,
        pageId: 'ghost-page',
        token,
      }),
    ).toBeNull();
  });
});
