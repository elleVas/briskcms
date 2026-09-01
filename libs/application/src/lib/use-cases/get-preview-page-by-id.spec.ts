import { describe, expect, it } from 'vitest';
import { Site, SiteLayoutSection } from '@brisk/domain-core';
import { createPageGroup } from './create-page-group.use-case';
import { createPageGroupTranslation } from './create-page-group-translation.use-case';
import { publishPageTranslation } from './publish-page-translation.use-case';
import { savePageGroupContent } from './save-page-group-content.use-case';
import { getPreviewPageById } from './get-preview-page-by-id.use-case';
import {
  InMemoryPageGroupRepository,
  InMemoryPageGroupVersionRepository,
  InMemoryPageTranslationRepository,
  InMemoryPageTranslationVersionRepository,
  InMemoryPreviewTokenPort,
  InMemorySearchPort,
  InMemorySiteLayoutSectionRepository,
  InMemorySiteRepository,
  InMemorySiteThemeBlockStylesRepository,
} from './in-memory-repositories.test-fixture';

describe('getPreviewPageById', () => {
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
      previewTokenPort: new InMemoryPreviewTokenPort(),
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
      themeAllowedTrackerDomains: [],
      formSubmissionRetentionDays: null,
      createdAt: new Date(),
    });
    await siteRepository.save(site);
    return site;
  }

  async function createGroupAndTranslation(
    deps: ReturnType<typeof setup>,
    slug: string,
    title: string,
    content: Parameters<typeof createPageGroup>[1]['content'] = [],
  ) {
    const group = await createPageGroup(deps, {
      tenantId,
      siteId: 'site-1',
      content,
      createdBy: 'user-1',
    });
    const translation = await createPageGroupTranslation(deps, {
      tenantId,
      pageGroupId: group.id,
      locale: 'it',
      slug,
      seoMeta: { title, description: '' },
      createdBy: 'user-1',
    });
    return { group, translation };
  }

  it('returns the draft content behind a valid token, even for a never-published page', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    const { translation } = await createGroupAndTranslation(
      deps,
      'bozza',
      'Bozza',
      [{ type: 'Hero', props: { title: 'In lavorazione' } }],
    );
    const { token } = await deps.previewTokenPort.createToken(
      tenantId,
      'page',
      translation.id,
      60_000,
    );

    const result = await getPreviewPageById(deps, {
      tenantId,
      pageId: translation.id,
      token,
    });

    expect(result?.content).toEqual([
      { type: 'Hero', props: { title: 'In lavorazione' } },
    ]);
  });

  it('shows unpublished draft edits made after the last publish', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    const { group, translation } = await createGroupAndTranslation(
      deps,
      'chi-siamo',
      'Chi siamo',
      [{ type: 'Text', props: { body: 'published version' } }],
    );
    await publishPageTranslation(deps, {
      tenantId,
      pageTranslationId: translation.id,
    });
    // Edited again after publishing — unlike getPublishedPageBySlug's
    // frozen publishedSnapshot, preview always shows the CURRENT live
    // merge of PageGroup.content (see the use case's own comment).
    await savePageGroupContent(deps, {
      tenantId,
      pageGroupId: group.id,
      content: [{ type: 'Text', props: { body: 'unpublished draft edit' } }],
      actorUserId: 'user-1',
    });
    const { token } = await deps.previewTokenPort.createToken(
      tenantId,
      'page',
      translation.id,
      60_000,
    );

    const result = await getPreviewPageById(deps, {
      tenantId,
      pageId: translation.id,
      token,
    });

    expect(result?.content).toEqual([
      { type: 'Text', props: { body: 'unpublished draft edit' } },
    ]);
  });

  it('shows the real draft of header/footer, not just what is published', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    const { translation } = await createGroupAndTranslation(
      deps,
      'chi-siamo',
      'Chi siamo',
    );
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
      translation.id,
      60_000,
    );

    const result = await getPreviewPageById(deps, {
      tenantId,
      pageId: translation.id,
      token,
    });

    expect(result?.header).toEqual([
      { type: 'Header', props: { label: 'draft header' } },
    ]);
  });

  it('returns null for a missing/expired/mismatched token', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    const { translation } = await createGroupAndTranslation(
      deps,
      'chi-siamo',
      'Chi siamo',
    );

    expect(
      await getPreviewPageById(deps, {
        tenantId,
        pageId: translation.id,
        token: 'not-a-real-token',
      }),
    ).toBeNull();
  });

  it('returns null when the token belongs to a different page', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    const { translation } = await createGroupAndTranslation(
      deps,
      'chi-siamo',
      'Chi siamo',
    );
    const { token } = await deps.previewTokenPort.createToken(
      tenantId,
      'page',
      'another-page-id',
      60_000,
    );

    expect(
      await getPreviewPageById(deps, {
        tenantId,
        pageId: translation.id,
        token,
      }),
    ).toBeNull();
  });

  it('returns null for a token belonging to a different tenant', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    const { translation } = await createGroupAndTranslation(
      deps,
      'chi-siamo',
      'Chi siamo',
    );
    const { token } = await deps.previewTokenPort.createToken(
      'another-tenant',
      'page',
      translation.id,
      60_000,
    );

    expect(
      await getPreviewPageById(deps, {
        tenantId,
        pageId: translation.id,
        token,
      }),
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
