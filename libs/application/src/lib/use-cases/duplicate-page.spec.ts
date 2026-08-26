import { describe, expect, it } from 'vitest';
import {
  PageNotFoundError,
  PageSlugAlreadyExistsError,
} from '@brisk/domain-core';
import { createPage } from './create-page.use-case.js';
import { duplicatePage } from './duplicate-page.use-case.js';
import {
  InMemoryPageRepository,
  InMemoryPageVersionRepository,
} from './in-memory-repositories.test-fixture.js';

describe('duplicatePage', () => {
  const tenantId = 'tenant-1';

  function setup() {
    const pageVersionRepository = new InMemoryPageVersionRepository();
    const pageRepository = new InMemoryPageRepository(pageVersionRepository);
    return { pageRepository, pageVersionRepository };
  }

  async function createSourcePage(
    deps: ReturnType<typeof setup>,
    overrides: {
      parentId?: string | null;
      status?: 'draft' | 'published';
    } = {},
  ) {
    const page = await createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: 'group-1',
      locale: 'it',
      slug: 'chi-siamo',
      parentId: overrides.parentId,
      seoMeta: {
        title: 'Chi siamo',
        description: 'La nostra storia',
        canonical: 'https://example.com/chi-siamo',
      },
      content: [{ type: 'Hero', props: { title: 'Ciao' } }],
      createdBy: 'user-1',
    });
    return page;
  }

  it('creates an independent draft copy with a new id, groupId and slug', async () => {
    const deps = setup();
    const source = await createSourcePage(deps);

    const duplicate = await duplicatePage(deps, {
      tenantId,
      sourcePageId: source.id,
      slug: 'chi-siamo-copia',
      title: 'Chi siamo (copia)',
      description: 'La nostra storia',
      createdBy: 'user-1',
    });

    expect(duplicate.id).not.toBe(source.id);
    expect(duplicate.groupId).not.toBe(source.groupId);
    expect(duplicate.slug).toBe('chi-siamo-copia');
    expect(duplicate.locale).toBe('it');
    expect(duplicate.siteId).toBe(source.siteId);
    expect(duplicate.content).toEqual(source.content);
    expect(duplicate.status).toBe('draft');
  });

  it('overrides title and description but keeps the rest of seoMeta from the source', async () => {
    const deps = setup();
    const source = await createSourcePage(deps);

    const duplicate = await duplicatePage(deps, {
      tenantId,
      sourcePageId: source.id,
      slug: 'chi-siamo-copia',
      title: 'Nuovo titolo',
      description: 'Nuova descrizione',
      createdBy: 'user-1',
    });

    expect(duplicate.seoMeta).toEqual({
      title: 'Nuovo titolo',
      description: 'Nuova descrizione',
      canonical: 'https://example.com/chi-siamo',
    });
  });

  it('inherits the parentId from the source page', async () => {
    const deps = setup();
    const parent = await createSourcePage(deps);
    const child = await createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: 'group-2',
      locale: 'it',
      slug: 'servizi',
      parentId: parent.id,
      seoMeta: { title: 'Servizi', description: '' },
      createdBy: 'user-1',
    });

    const duplicate = await duplicatePage(deps, {
      tenantId,
      sourcePageId: child.id,
      slug: 'servizi-copia',
      title: 'Servizi',
      description: '',
      createdBy: 'user-1',
    });

    expect(duplicate.parentId).toBe(parent.id);
  });

  it('never copies publishedContent/status — the copy always starts as a draft, even from a published source', async () => {
    const deps = setup();
    const source = await createSourcePage(deps);
    source.publish();
    await deps.pageRepository.save(source);

    const duplicate = await duplicatePage(deps, {
      tenantId,
      sourcePageId: source.id,
      slug: 'chi-siamo-copia',
      title: 'Chi siamo (copia)',
      description: 'La nostra storia',
      createdBy: 'user-1',
    });

    expect(duplicate.status).toBe('draft');
    expect(duplicate.publishedContent).toBeNull();
  });

  it('records an initial version for the duplicate', async () => {
    const deps = setup();
    const source = await createSourcePage(deps);

    const duplicate = await duplicatePage(deps, {
      tenantId,
      sourcePageId: source.id,
      slug: 'chi-siamo-copia',
      title: 'Chi siamo (copia)',
      description: 'La nostra storia',
      createdBy: 'user-1',
    });

    const versions = await deps.pageVersionRepository.listByPage(
      tenantId,
      duplicate.id,
    );
    expect(versions).toHaveLength(1);
    expect(versions[0].content).toEqual(duplicate.content);
  });

  it('throws PageNotFoundError for a nonexistent source page', async () => {
    const deps = setup();

    await expect(
      duplicatePage(deps, {
        tenantId,
        sourcePageId: 'does-not-exist',
        slug: 'chi-siamo-copia',
        title: 'Chi siamo (copia)',
        description: '',
        createdBy: 'user-1',
      }),
    ).rejects.toThrow(PageNotFoundError);
  });

  it('throws PageSlugAlreadyExistsError if the slug is already used in that locale', async () => {
    const deps = setup();
    const source = await createSourcePage(deps);
    await createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: 'group-other',
      locale: 'it',
      slug: 'chi-siamo-copia',
      seoMeta: { title: 'x', description: '' },
      createdBy: 'user-1',
    });

    await expect(
      duplicatePage(deps, {
        tenantId,
        sourcePageId: source.id,
        slug: 'chi-siamo-copia',
        title: 'Chi siamo (copia)',
        description: '',
        createdBy: 'user-1',
      }),
    ).rejects.toThrow(PageSlugAlreadyExistsError);
  });
});
