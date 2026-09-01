import { describe, expect, it } from 'vitest';
import type { PageContent } from '@brisk/shared-types';
import { createPageGroup } from './create-page-group.use-case';
import { createPageGroupTranslation } from './create-page-group-translation.use-case';
import { resolvePageContentReferences } from './resolve-page-content-references';
import {
  InMemoryPageGroupRepository,
  InMemoryPageGroupVersionRepository,
  InMemoryPageTranslationRepository,
  InMemoryPageTranslationVersionRepository,
} from './in-memory-repositories.test-fixture';

describe('resolvePageContentReferences', () => {
  const tenantId = 'tenant-1';

  function setup() {
    const pageGroupVersionRepository = new InMemoryPageGroupVersionRepository();
    const pageGroupRepository = new InMemoryPageGroupRepository(
      pageGroupVersionRepository,
    );
    const pageTranslationVersionRepository =
      new InMemoryPageTranslationVersionRepository();
    const pageTranslationRepository = new InMemoryPageTranslationRepository(
      pageTranslationVersionRepository,
    );
    return { pageGroupRepository, pageTranslationRepository };
  }

  async function createGroupWithTranslation(
    deps: ReturnType<typeof setup>,
    locale: string,
    slug: string,
  ) {
    const group = await createPageGroup(deps, {
      tenantId,
      siteId: 'site-1',
      createdBy: 'user-1',
    });
    const translation = await createPageGroupTranslation(deps, {
      tenantId,
      pageGroupId: group.id,
      locale,
      slug,
      seoMeta: { title: slug, description: '' },
      createdBy: 'user-1',
    });
    return { group, translation };
  }

  it('resolves a page reference to the destination locale/slug', async () => {
    const deps = setup();
    const { group: docsGroup } = await createGroupWithTranslation(
      deps,
      'it',
      'documentazione',
    );

    const content: PageContent = [
      {
        id: 'nav-1',
        type: 'NavLink',
        props: {
          label: 'Docs',
          linkType: 'page',
          page: { pageGroupId: docsGroup.id, title: 'Documentazione' },
          url: '',
        },
      },
    ];

    const [resolved] = await resolvePageContentReferences(
      deps,
      tenantId,
      'it',
      [content],
    );

    expect(resolved[0].props['page']).toEqual({
      pageGroupId: docsGroup.id,
      title: 'Documentazione',
      locale: 'it',
      slug: 'documentazione',
    });
  });

  it('resolves to null when the referenced group has no translation in this locale', async () => {
    const deps = setup();
    const { group: docsGroup } = await createGroupWithTranslation(
      deps,
      'it',
      'documentazione',
    );

    const content: PageContent = [
      {
        id: 'nav-1',
        type: 'NavLink',
        props: {
          label: 'Docs',
          linkType: 'page',
          page: { pageGroupId: docsGroup.id, title: 'Documentazione' },
          url: '',
        },
      },
    ];

    // Requesting 'en', but the group only has an 'it' translation.
    const [resolved] = await resolvePageContentReferences(
      deps,
      tenantId,
      'en',
      [content],
    );

    expect(resolved[0].props['page']).toBeNull();
  });

  it('shares one lookup across multiple content trees (e.g. page content + header)', async () => {
    const deps = setup();
    const { group: docsGroup } = await createGroupWithTranslation(
      deps,
      'it',
      'documentazione',
    );
    const pageRefBlock = {
      id: 'nav-1',
      type: 'NavLink',
      props: {
        label: 'Docs',
        linkType: 'page',
        page: { pageGroupId: docsGroup.id, title: 'Documentazione' },
        url: '',
      },
    };
    const header: PageContent = [pageRefBlock];
    const footer: PageContent = [{ ...pageRefBlock, id: 'nav-2' }];

    const [resolvedHeader, resolvedFooter] = await resolvePageContentReferences(
      deps,
      tenantId,
      'it',
      [header, footer],
    );

    expect(resolvedHeader[0].props['page']).toMatchObject({
      locale: 'it',
      slug: 'documentazione',
    });
    expect(resolvedFooter[0].props['page']).toMatchObject({
      locale: 'it',
      slug: 'documentazione',
    });
  });

  it('returns the content trees unchanged when nothing references a page', async () => {
    const deps = setup();
    const content: PageContent = [
      { id: 'text-1', type: 'Text', props: { body: 'hi' } },
    ];

    const [resolved] = await resolvePageContentReferences(
      deps,
      tenantId,
      'it',
      [content],
    );

    expect(resolved).toEqual(content);
  });
});
