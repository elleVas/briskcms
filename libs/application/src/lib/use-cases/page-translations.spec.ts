import { describe, expect, it } from 'vitest';
import {
  PageNotFoundError,
  PageTranslationAlreadyExistsError,
  PageSlugAlreadyExistsError,
} from '@brisk/domain-core';
import { computeContentStructureSignature } from '@brisk/shared-types';
import { createPage } from './create-page.use-case';
import { createPageTranslation } from './create-page-translation.use-case';
import { listPageTranslations } from './list-page-translations.use-case';
import { markTranslationSynced } from './mark-translation-synced.use-case';
import {
  InMemoryPageRepository,
  InMemoryPageVersionRepository,
} from './in-memory-repositories.test-fixture';

describe('createPageTranslation', () => {
  const tenantId = 'tenant-1';

  function setup() {
    const pageVersionRepository = new InMemoryPageVersionRepository();
    const pageRepository = new InMemoryPageRepository(pageVersionRepository);
    return { pageRepository, pageVersionRepository };
  }

  async function createSourcePage(deps: ReturnType<typeof setup>) {
    return createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: 'group-1',
      locale: 'it',
      slug: 'chi-siamo',
      seoMeta: { title: 'Chi siamo', description: 'La nostra storia' },
      content: [{ type: 'Hero', props: { title: 'Ciao' } }],
      createdBy: 'user-1',
    });
  }

  it('creates a new page in the same group, copying content and seoMeta', async () => {
    const deps = setup();
    const source = await createSourcePage(deps);

    const translation = await createPageTranslation(deps, {
      tenantId,
      sourcePageId: source.id,
      locale: 'en',
      slug: 'about-us',
      createdBy: 'user-1',
    });

    expect(translation.groupId).toBe('group-1');
    expect(translation.locale).toBe('en');
    expect(translation.slug).toBe('about-us');
    expect(translation.content).toEqual([
      { type: 'Hero', props: { title: 'Ciao' } },
    ]);
    expect(translation.seoMeta).toEqual({
      title: 'Chi siamo',
      description: 'La nostra storia',
    });
    expect(translation.status).toBe('draft');
  });

  it('starts in sync with the source content it was copied from', async () => {
    const deps = setup();
    const source = await createSourcePage(deps);

    const translation = await createPageTranslation(deps, {
      tenantId,
      sourcePageId: source.id,
      locale: 'en',
      slug: 'about-us',
      createdBy: 'user-1',
    });

    expect(translation.syncedStructureSignature).toBe(
      computeContentStructureSignature(source.content),
    );
  });

  it('records an initial version for the new translation', async () => {
    const deps = setup();
    const source = await createSourcePage(deps);

    const translation = await createPageTranslation(deps, {
      tenantId,
      sourcePageId: source.id,
      locale: 'en',
      slug: 'about-us',
      createdBy: 'user-1',
    });

    const versions = await deps.pageVersionRepository.listByPage(
      tenantId,
      translation.id,
    );
    expect(versions).toHaveLength(1);
    expect(versions[0].content).toEqual(translation.content);
  });

  it('throws PageNotFoundError for a nonexistent source page', async () => {
    const deps = setup();

    await expect(
      createPageTranslation(deps, {
        tenantId,
        sourcePageId: 'does-not-exist',
        locale: 'en',
        slug: 'about-us',
        createdBy: 'user-1',
      }),
    ).rejects.toThrow(PageNotFoundError);
  });

  it('throws PageTranslationAlreadyExistsError if the group already has that locale', async () => {
    const deps = setup();
    const source = await createSourcePage(deps);
    await createPageTranslation(deps, {
      tenantId,
      sourcePageId: source.id,
      locale: 'en',
      slug: 'about-us',
      createdBy: 'user-1',
    });

    await expect(
      createPageTranslation(deps, {
        tenantId,
        sourcePageId: source.id,
        locale: 'en',
        slug: 'about-us-2',
        createdBy: 'user-1',
      }),
    ).rejects.toThrow(PageTranslationAlreadyExistsError);
  });

  it('throws PageSlugAlreadyExistsError if the slug is already used in that locale', async () => {
    const deps = setup();
    const source = await createSourcePage(deps);
    await createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: 'group-other',
      locale: 'en',
      slug: 'about-us',
      seoMeta: { title: 'x', description: '' },
      createdBy: 'user-1',
    });

    await expect(
      createPageTranslation(deps, {
        tenantId,
        sourcePageId: source.id,
        locale: 'en',
        slug: 'about-us',
        createdBy: 'user-1',
      }),
    ).rejects.toThrow(PageSlugAlreadyExistsError);
  });
});

describe('listPageTranslations', () => {
  const tenantId = 'tenant-1';

  function setup() {
    const pageVersionRepository = new InMemoryPageVersionRepository();
    const pageRepository = new InMemoryPageRepository(pageVersionRepository);
    return { pageRepository, pageVersionRepository };
  }

  it('lists every page in the same group, including the page itself', async () => {
    const deps = setup();
    const source = await createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: 'group-1',
      locale: 'it',
      slug: 'chi-siamo',
      seoMeta: { title: 'Chi siamo', description: '' },
      createdBy: 'user-1',
    });
    const translation = await createPageTranslation(deps, {
      tenantId,
      sourcePageId: source.id,
      locale: 'en',
      slug: 'about-us',
      createdBy: 'user-1',
    });

    const results = await listPageTranslations(deps, {
      tenantId,
      pageId: source.id,
    });

    expect(results.map((p) => p.id).sort()).toEqual(
      [source.id, translation.id].sort(),
    );
  });

  it('throws PageNotFoundError for a nonexistent page', async () => {
    const deps = setup();

    await expect(
      listPageTranslations(deps, { tenantId, pageId: 'does-not-exist' }),
    ).rejects.toThrow(PageNotFoundError);
  });
});

describe('markTranslationSynced', () => {
  const tenantId = 'tenant-1';

  function setup() {
    const pageVersionRepository = new InMemoryPageVersionRepository();
    const pageRepository = new InMemoryPageRepository(pageVersionRepository);
    return { pageRepository, pageVersionRepository };
  }

  it('replaces the signature with the one the caller provides', async () => {
    const deps = setup();
    const source = await createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: 'group-1',
      locale: 'it',
      slug: 'chi-siamo',
      seoMeta: { title: 'Chi siamo', description: '' },
      createdBy: 'user-1',
    });
    const translation = await createPageTranslation(deps, {
      tenantId,
      sourcePageId: source.id,
      locale: 'en',
      slug: 'about-us',
      createdBy: 'user-1',
    });

    const updated = await markTranslationSynced(deps, {
      tenantId,
      pageId: translation.id,
      structureSignature: 'new-signature',
    });

    expect(updated.syncedStructureSignature).toBe('new-signature');
  });

  it('throws PageNotFoundError for a nonexistent page', async () => {
    const deps = setup();

    await expect(
      markTranslationSynced(deps, {
        tenantId,
        pageId: 'does-not-exist',
        structureSignature: 'sig',
      }),
    ).rejects.toThrow(PageNotFoundError);
  });
});
