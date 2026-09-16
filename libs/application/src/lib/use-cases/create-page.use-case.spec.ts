import { describe, expect, it } from 'vitest';
import {
  PageSlugAlreadyExistsError,
  PageSlugCollidesWithTermError,
  Taxonomy,
} from '@brisk/domain-core';
import { createPage } from './create-page.use-case';
import { createPageGroupTranslation } from './create-page-group-translation.use-case';
import { createPageGroup } from './create-page-group.use-case';
import {
  InMemoryPageGroupRepository,
  InMemoryPageGroupVersionRepository,
  InMemoryPageTranslationRepository,
  InMemoryPageTranslationVersionRepository,
  InMemoryReusableSectionRepository,
  InMemoryTaxonomyRepository,
} from '@brisk/testing';

const tenantId = 'tenant-1';
const siteId = 'site-1';

function setup() {
  const pageGroupVersionRepository = new InMemoryPageGroupVersionRepository();
  const pageTranslationRepository = new InMemoryPageTranslationRepository(
    new InMemoryPageTranslationVersionRepository(),
  );
  return {
    pageGroupRepository: new InMemoryPageGroupRepository(
      pageGroupVersionRepository,
      pageTranslationRepository,
    ),
    pageGroupVersionRepository,
    pageTranslationRepository,
    taxonomyRepository: new InMemoryTaxonomyRepository(),
    reusableSectionRepository: new InMemoryReusableSectionRepository(),
  };
}

type Deps = ReturnType<typeof setup>;

function create(
  deps: Deps,
  overrides: Partial<Parameters<typeof createPage>[1]> = {},
) {
  return createPage(deps, {
    tenantId,
    siteId,
    locale: 'it',
    slug: 'chi-siamo',
    seoMeta: { title: 'Chi siamo', description: '' },
    createdBy: 'user-1',
    ...overrides,
  });
}

/** Every group of the site at the root, with how many languages each has. */
async function rootPages(deps: Deps) {
  const groups = await deps.pageGroupRepository.listSiblings(
    tenantId,
    siteId,
    null,
  );
  return Promise.all(
    groups.map(async (group) => ({
      id: group.id,
      languages: (
        await deps.pageTranslationRepository.listByGroup(tenantId, group.id)
      ).length,
    })),
  );
}

describe('createPage', () => {
  it('creates the page, its first version and its first language together', async () => {
    const deps = setup();

    const { group, translation } = await create(deps, {
      collectionId: 'collection-news',
      content: [{ id: 'hero-1', type: 'Hero', props: { title: 'Ciao' } }],
    });

    expect(group.collectionId).toBe('collection-news');
    expect(translation.pageGroupId).toBe(group.id);
    expect(translation).toMatchObject({
      locale: 'it',
      slug: 'chi-siamo',
      status: 'draft',
    });
    expect(translation.seoMeta.title).toBe('Chi siamo');
    const versions = await deps.pageGroupVersionRepository.listByGroup(
      tenantId,
      group.id,
    );
    expect(versions.map((version) => version.content)).toEqual([group.content]);
    expect(await rootPages(deps)).toEqual([{ id: group.id, languages: 1 }]);
  });

  /*
   * The bug this exists for: the editor created the group, then its
   * language, and a language refused for its address left a page with no
   * language — listed with no title, crashing the editor that opened it.
   */
  it('writes nothing when the address is already taken', async () => {
    const deps = setup();
    const { group: existing } = await create(deps);

    await expect(create(deps, { slug: 'chi-siamo' })).rejects.toThrow(
      PageSlugAlreadyExistsError,
    );

    expect(await rootPages(deps)).toEqual([{ id: existing.id, languages: 1 }]);
  });

  it('writes nothing when a dimension already answers at that root address', async () => {
    const deps = setup();
    await deps.taxonomyRepository.saveTaxonomy(
      Taxonomy.create({
        id: 'taxonomy-1',
        tenantId,
        siteId,
        name: { it: 'Categorie' },
        prefix: 'categorie',
      }),
    );

    await expect(create(deps, { slug: 'categorie' })).rejects.toThrow(
      PageSlugCollidesWithTermError,
    );
    expect(await rootPages(deps)).toEqual([]);
  });

  it('lets a nested page take an address its parent level already uses', async () => {
    const deps = setup();
    const { group: parent } = await create(deps, { slug: 'servizi' });

    const { translation } = await create(deps, {
      parentId: parent.id,
      slug: 'servizi',
    });

    expect(translation.slug).toBe('servizi');
  });

  it('appends the page after the siblings already there', async () => {
    const deps = setup();
    const first = await createPageGroup(deps, {
      tenantId,
      siteId,
      createdBy: null,
    });
    await createPageGroupTranslation(deps, {
      tenantId,
      pageGroupId: first.id,
      locale: 'it',
      slug: 'prima',
      seoMeta: { title: 'Prima', description: '' },
      createdBy: null,
    });

    const { group } = await create(deps, { slug: 'seconda' });

    expect(group.order).toBe(first.order + 1);
  });

  it('refuses content and a template together rather than choosing one', async () => {
    const deps = setup();

    await expect(
      create(deps, {
        templateId: 'template-1',
        content: [{ id: 'hero-1', type: 'Hero', props: {} }],
      }),
    ).rejects.toThrow('not both');
    expect(await rootPages(deps)).toEqual([]);
  });
});
