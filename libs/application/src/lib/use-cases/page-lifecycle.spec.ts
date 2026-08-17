import { describe, expect, it } from 'vitest';
import type { Page, PageVersion } from '@brisk/domain-core';
import type {
  PageRepositoryPort,
  PageVersionRepositoryPort,
} from '@brisk/ports';
import { createPage } from './create-page.use-case.js';
import { saveDraft } from './save-draft.use-case.js';
import { publishPage } from './publish-page.use-case.js';
import { listPageVersions } from './list-page-versions.use-case.js';
import { rollbackToVersion } from './rollback-to-version.use-case.js';

class InMemoryPageRepository implements PageRepositoryPort {
  private pages = new Map<string, Page>();

  async save(page: Page): Promise<void> {
    this.pages.set(page.id, page);
  }

  async findById(tenantId: string, pageId: string): Promise<Page | null> {
    const page = this.pages.get(pageId);
    return page && page.tenantId === tenantId ? page : null;
  }

  async findBySlug(
    tenantId: string,
    siteId: string,
    locale: string,
    slug: string,
  ): Promise<Page | null> {
    for (const page of this.pages.values()) {
      if (
        page.tenantId === tenantId &&
        page.siteId === siteId &&
        page.locale === locale &&
        page.slug === slug
      ) {
        return page;
      }
    }
    return null;
  }

  async delete(tenantId: string, pageId: string): Promise<void> {
    const page = this.pages.get(pageId);
    if (page && page.tenantId === tenantId) {
      this.pages.delete(pageId);
    }
  }
}

class InMemoryPageVersionRepository implements PageVersionRepositoryPort {
  private versions: PageVersion[] = [];

  async save(version: PageVersion): Promise<void> {
    this.versions.push(version);
  }

  async findById(
    tenantId: string,
    versionId: string,
  ): Promise<PageVersion | null> {
    return (
      this.versions.find(
        (v) => v.tenantId === tenantId && v.id === versionId,
      ) ?? null
    );
  }

  async listByPage(tenantId: string, pageId: string): Promise<PageVersion[]> {
    return this.versions.filter(
      (v) => v.tenantId === tenantId && v.pageId === pageId,
    );
  }
}

describe('page lifecycle: create -> draft -> publish -> rollback', () => {
  const tenantId = 'tenant-1';
  const otherTenantId = 'tenant-2';

  function setup() {
    const pageRepository = new InMemoryPageRepository();
    const pageVersionRepository = new InMemoryPageVersionRepository();
    return { pageRepository, pageVersionRepository };
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
  });
});
