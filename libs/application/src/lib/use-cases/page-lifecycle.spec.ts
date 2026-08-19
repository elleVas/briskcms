import { describe, expect, it } from 'vitest';
import { createPage } from './create-page.use-case.js';
import { deletePage } from './delete-page.use-case.js';
import { saveDraft } from './save-draft.use-case.js';
import { publishPage } from './publish-page.use-case.js';
import { listPageVersions } from './list-page-versions.use-case.js';
import { listPages } from './list-pages.use-case.js';
import { rollbackToVersion } from './rollback-to-version.use-case.js';
import {
  InMemoryPageRepository,
  InMemoryPageVersionRepository,
  InMemorySearchPort,
} from './in-memory-repositories.test-fixture.js';

describe('page lifecycle: create -> draft -> publish -> rollback', () => {
  const tenantId = 'tenant-1';
  const otherTenantId = 'tenant-2';

  function setup() {
    const pageRepository = new InMemoryPageRepository();
    const pageVersionRepository = new InMemoryPageVersionRepository();
    const searchPort = new InMemorySearchPort();
    return { pageRepository, pageVersionRepository, searchPort };
  }

  it('runs the full draft -> publish -> rollback cycle without destructive overwrites', async () => {
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

    expect(page.status).toBe('draft');
    expect(page.publishedContent).toBeNull();

    const afterFirstDraft = await saveDraft(deps, {
      tenantId,
      pageId: page.id,
      content: [{ type: 'Hero', props: { title: 'Versione 1' } }],
      actorUserId: 'user-1',
    });
    expect(afterFirstDraft.content).toEqual([
      { type: 'Hero', props: { title: 'Versione 1' } },
    ]);

    const published = await publishPage(deps, { tenantId, pageId: page.id });
    expect(published.status).toBe('published');
    expect(published.publishedContent).toEqual([
      { type: 'Hero', props: { title: 'Versione 1' } },
    ]);

    // un ulteriore salvataggio draft NON deve toccare il contenuto già pubblicato
    const afterSecondDraft = await saveDraft(deps, {
      tenantId,
      pageId: page.id,
      content: [{ type: 'Hero', props: { title: 'Versione 2 (bozza)' } }],
      actorUserId: 'user-1',
    });
    expect(afterSecondDraft.content).toEqual([
      { type: 'Hero', props: { title: 'Versione 2 (bozza)' } },
    ]);
    expect(afterSecondDraft.publishedContent).toEqual([
      { type: 'Hero', props: { title: 'Versione 1' } },
    ]);

    const versions = await listPageVersions(deps, {
      tenantId,
      pageId: page.id,
    });
    expect(versions).toHaveLength(3); // create, draft v1, draft v2
    const firstVersion = versions[0];

    const afterRollback = await rollbackToVersion(deps, {
      tenantId,
      pageId: page.id,
      versionId: firstVersion.id,
      actorUserId: 'user-1',
    });

    // il rollback ripristina il draft alla versione scelta ma non tocca il pubblicato
    expect(afterRollback.content).toEqual(firstVersion.content);
    expect(afterRollback.publishedContent).toEqual([
      { type: 'Hero', props: { title: 'Versione 1' } },
    ]);
    expect(afterRollback.status).toBe('published');

    const versionsAfterRollback = await listPageVersions(deps, {
      tenantId,
      pageId: page.id,
    });
    expect(versionsAfterRollback).toHaveLength(4); // il rollback stesso crea una nuova versione
  });

  it('never leaks pages or versions across tenants', async () => {
    const deps = setup();

    const pageA = await createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: 'group-a',
      locale: 'it',
      slug: 'home',
      seoMeta: { title: 'Tenant A', description: '...' },
      createdBy: null,
    });

    await createPage(deps, {
      tenantId: otherTenantId,
      siteId: 'site-2',
      groupId: 'group-b',
      locale: 'it',
      slug: 'home',
      seoMeta: { title: 'Tenant B', description: '...' },
      createdBy: null,
    });

    const foundFromOtherTenant = await deps.pageRepository.findById(
      otherTenantId,
      pageA.id,
    );
    expect(foundFromOtherTenant).toBeNull();

    const versionsFromOtherTenant = await listPageVersions(deps, {
      tenantId: otherTenantId,
      pageId: pageA.id,
    });
    expect(versionsFromOtherTenant).toHaveLength(0);

    const pagesForTenantA = await listPages(deps, {
      tenantId,
      siteId: 'site-1',
      page: 1,
      pageSize: 20,
    });
    expect(pagesForTenantA.items.map((page) => page.id)).toEqual([pageA.id]);
    expect(pagesForTenantA.total).toBe(1);

    const pagesFromOtherTenant = await listPages(deps, {
      tenantId: otherTenantId,
      siteId: 'site-1',
      page: 1,
      pageSize: 20,
    });
    expect(pagesFromOtherTenant.items).toHaveLength(0);
    expect(pagesFromOtherTenant.total).toBe(0);
  });

  it('deletePage removes the page from a tenant-scoped list', async () => {
    const deps = setup();
    const page = await createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: 'group-1',
      locale: 'it',
      slug: 'da-eliminare',
      seoMeta: { title: 'Da eliminare', description: '...' },
      createdBy: 'user-1',
    });

    await deletePage(deps, { tenantId, pageId: page.id });

    expect(await deps.pageRepository.findById(tenantId, page.id)).toBeNull();
    const pages = await listPages(deps, {
      tenantId,
      siteId: 'site-1',
      page: 1,
      pageSize: 20,
    });
    expect(pages.items.map((p) => p.id)).not.toContain(page.id);
  });

  it('listPages paginates and reports the total across all pages', async () => {
    const deps = setup();
    for (let i = 0; i < 5; i++) {
      await createPage(deps, {
        tenantId,
        siteId: 'site-1',
        groupId: `group-${i}`,
        locale: 'it',
        slug: `page-${i}`,
        seoMeta: { title: `Page ${i}`, description: '...' },
        createdBy: null,
      });
    }

    const firstPage = await listPages(deps, {
      tenantId,
      siteId: 'site-1',
      page: 1,
      pageSize: 2,
    });
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.total).toBe(5);

    const secondPage = await listPages(deps, {
      tenantId,
      siteId: 'site-1',
      page: 2,
      pageSize: 2,
    });
    expect(secondPage.items).toHaveLength(2);
    expect(secondPage.total).toBe(5);

    const thirdPage = await listPages(deps, {
      tenantId,
      siteId: 'site-1',
      page: 3,
      pageSize: 2,
    });
    expect(thirdPage.items).toHaveLength(1);
    expect(thirdPage.total).toBe(5);

    const allIds = [
      ...firstPage.items,
      ...secondPage.items,
      ...thirdPage.items,
    ].map((page) => page.id);
    expect(new Set(allIds).size).toBe(5);
  });
});
