import { describe, expect, it } from 'vitest';
import {
  PageNotFoundError,
  PageSlugAlreadyExistsError,
  PageVersionNotFoundError,
} from '@brisk/domain-core';
import { createPage } from './create-page.use-case.js';
import { deletePage } from './delete-page.use-case.js';
import { saveDraft } from './save-draft.use-case.js';
import { publishPage } from './publish-page.use-case.js';
import { rollbackToVersion } from './rollback-to-version.use-case.js';
import {
  InMemoryPageRepository,
  InMemoryPageVersionRepository,
} from './in-memory-repositories.test-fixture.js';

const tenantId = 'tenant-1';

function setup() {
  const pageRepository = new InMemoryPageRepository();
  const pageVersionRepository = new InMemoryPageVersionRepository();
  return { pageRepository, pageVersionRepository };
}

describe('use-case error paths', () => {
  it('saveDraft throws PageNotFoundError for a nonexistent page', async () => {
    const deps = setup();

    await expect(
      saveDraft(deps, {
        tenantId,
        pageId: 'does-not-exist',
        content: [],
        actorUserId: 'user-1',
      }),
    ).rejects.toThrow(PageNotFoundError);
  });

  it('publishPage throws PageNotFoundError for a nonexistent page', async () => {
    const deps = setup();

    await expect(
      publishPage(deps, { tenantId, pageId: 'does-not-exist' }),
    ).rejects.toThrow(PageNotFoundError);
  });

  it('rollbackToVersion throws PageNotFoundError for a nonexistent page', async () => {
    const deps = setup();

    await expect(
      rollbackToVersion(deps, {
        tenantId,
        pageId: 'does-not-exist',
        versionId: 'irrelevant',
        actorUserId: 'user-1',
      }),
    ).rejects.toThrow(PageNotFoundError);
  });

  it('rollbackToVersion throws PageVersionNotFoundError for a nonexistent version', async () => {
    const deps = setup();
    const page = await createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: 'group-1',
      locale: 'it',
      slug: 'home',
      seoMeta: { title: 'Home', description: 'La home del sito' },
      createdBy: 'user-1',
    });

    await expect(
      rollbackToVersion(deps, {
        tenantId,
        pageId: page.id,
        versionId: 'does-not-exist',
        actorUserId: 'user-1',
      }),
    ).rejects.toThrow(PageVersionNotFoundError);
  });

  it('rollbackToVersion throws PageVersionNotFoundError for a version belonging to another page', async () => {
    const deps = setup();
    const pageA = await createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: 'group-1',
      locale: 'it',
      slug: 'home',
      seoMeta: { title: 'Pagina A', description: '...' },
      createdBy: 'user-1',
    });
    const pageB = await createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: 'group-1',
      locale: 'it',
      slug: 'chi-siamo',
      seoMeta: { title: 'Pagina B', description: '...' },
      createdBy: 'user-1',
    });
    const versionsOfB = await deps.pageVersionRepository.listByPage(
      tenantId,
      pageB.id,
    );

    await expect(
      rollbackToVersion(deps, {
        tenantId,
        pageId: pageA.id,
        versionId: versionsOfB[0].id,
        actorUserId: 'user-1',
      }),
    ).rejects.toThrow(PageVersionNotFoundError);
  });

  it('createPage throws PageSlugAlreadyExistsError for a slug already used on that site/locale', async () => {
    const deps = setup();
    await createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: 'group-1',
      locale: 'it',
      slug: 'chi-siamo',
      seoMeta: { title: 'Chi siamo', description: '...' },
      createdBy: 'user-1',
    });

    await expect(
      createPage(deps, {
        tenantId,
        siteId: 'site-1',
        groupId: 'group-2',
        locale: 'it',
        slug: 'chi-siamo',
        seoMeta: { title: 'Chi siamo di nuovo', description: '...' },
        createdBy: 'user-1',
      }),
    ).rejects.toThrow(PageSlugAlreadyExistsError);
  });

  it('deletePage throws PageNotFoundError for a nonexistent page', async () => {
    const deps = setup();

    await expect(
      deletePage(deps, { tenantId, pageId: 'does-not-exist' }),
    ).rejects.toThrow(PageNotFoundError);
  });
});
