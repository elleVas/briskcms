import { describe, expect, it } from 'vitest';
import type { PageContent } from '@brisk/shared-types';
import { Term, User } from '@brisk/domain-core';
import { createPageGroup } from './create-page-group.use-case';
import { createPageGroupTranslation } from './create-page-group-translation.use-case';
import {
  currentArticleOf,
  hasArticleBlocks,
  resolveArticleBlocks,
} from './resolve-article-blocks';
import {
  InMemoryPageGroupRepository,
  InMemoryPageGroupVersionRepository,
  InMemoryPageTranslationRepository,
  InMemoryPageTranslationVersionRepository,
  InMemorySearchPort,
  InMemoryTaxonomyRepository,
  InMemoryUserRepository,
} from './in-memory-repositories.test-fixture';

const tenantId = 'tenant-1';
const siteId = 'site-1';
const locale = 'it';

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
    taxonomyRepository: new InMemoryTaxonomyRepository(),
    userRepository: new InMemoryUserRepository(),
    searchPort: new InMemorySearchPort(),
  };
}

/** A published page, optionally filed in a section and dated. */
async function seedPage(
  deps: ReturnType<typeof setup>,
  input: {
    slug: string;
    title: string;
    collectionId?: string | null;
    publishedAt?: Date;
    createdBy?: string | null;
  },
) {
  const group = await createPageGroup(deps, {
    tenantId,
    siteId,
    collectionId: input.collectionId ?? null,
    createdBy: input.createdBy ?? null,
  });
  const translation = await createPageGroupTranslation(deps, {
    tenantId,
    pageGroupId: group.id,
    locale,
    slug: input.slug,
    seoMeta: { title: input.title, description: `Summary of ${input.title}` },
    createdBy: null,
  });
  // Published through the entity rather than the use case, because the
  // date is what an archive is ordered by: `publish` takes the moment,
  // and a test that cannot set it can only ever assert one order.
  const stored = await deps.pageTranslationRepository.findById(
    tenantId,
    translation.id,
  );
  if (!stored) throw new Error('the translation just created is missing');
  stored.publish([], { by: null, now: input.publishedAt ?? new Date() });
  await deps.pageTranslationRepository.save(stored);
  return { group, translation: stored };
}

const articleContent: PageContent = [
  {
    id: 'meta',
    type: 'ArticleMeta',
    props: { showDate: true, showAuthor: true },
  },
  { id: 'nav', type: 'ArticleNav', props: {} },
  { id: 'related', type: 'RelatedPages', props: { limit: 2 } },
];

function propsOf(content: PageContent, id: string): Record<string, unknown> {
  return content.find((block) => block.id === id)?.props ?? {};
}

describe('hasArticleBlocks', () => {
  /*
   * Asked before the page's own row is read, because almost no page
   * carries one of these blocks and nobody should pay for that read.
   */
  it('says no for an ordinary page', () => {
    expect(hasArticleBlocks([[{ id: 'h', type: 'Heading', props: {} }]])).toBe(
      false,
    );
  });

  it('finds one nested inside a container', () => {
    expect(
      hasArticleBlocks([
        [
          {
            id: 'box',
            type: 'Container',
            props: {},
            children: [{ id: 'meta', type: 'ArticleMeta', props: {} }],
          },
        ],
      ]),
    ).toBe(true);
  });
});

describe('resolveArticleBlocks', () => {
  it('writes the date and the author of the page the block sits on', async () => {
    const deps = setup();
    await deps.userRepository.save(
      User.create({
        id: 'user-1',
        tenantId,
        email: 'giulia@example.com',
        displayName: 'Giulia Rossi',
        passwordHash: 'x',
        role: 'admin',
      }),
    );
    const { group, translation } = await seedPage(deps, {
      slug: 'primo',
      title: 'Primo',
      createdBy: 'user-1',
    });

    const current = await currentArticleOf(deps, tenantId, {
      pageGroupId: group.id,
      publishedAt: translation.publishedAt,
    });
    const [content] = await resolveArticleBlocks(
      deps,
      tenantId,
      siteId,
      locale,
      current!,
      [articleContent],
    );

    expect(propsOf(content, 'meta')['authorName']).toBe('Giulia Rossi');
    expect(typeof propsOf(content, 'meta')['publishedAt']).toBe('string');
  });

  /*
   * An account's email address is not something a page publishes, so a
   * page whose author never set a display name carries no byline at all.
   */
  it('leaves the byline empty rather than fall back to an email', async () => {
    const deps = setup();
    await deps.userRepository.save(
      User.create({
        id: 'user-2',
        tenantId,
        email: 'anonimo@example.com',
        displayName: '',
        passwordHash: 'x',
        role: 'editor',
      }),
    );
    const { group, translation } = await seedPage(deps, {
      slug: 'senza-nome',
      title: 'Senza nome',
      createdBy: 'user-2',
    });

    const current = await currentArticleOf(deps, tenantId, {
      pageGroupId: group.id,
      publishedAt: translation.publishedAt,
    });
    const [content] = await resolveArticleBlocks(
      deps,
      tenantId,
      siteId,
      locale,
      current!,
      [articleContent],
    );

    expect(propsOf(content, 'meta')['authorName']).toBe('');
  });

  it('points at the older and the newer page of the same section', async () => {
    const deps = setup();
    const older = await seedPage(deps, {
      slug: 'vecchio',
      title: 'Vecchio',
      collectionId: 'news',
      publishedAt: new Date('2026-01-01T10:00:00Z'),
    });
    const middle = await seedPage(deps, {
      slug: 'mezzo',
      title: 'Mezzo',
      collectionId: 'news',
      publishedAt: new Date('2026-02-01T10:00:00Z'),
    });
    const newer = await seedPage(deps, {
      slug: 'nuovo',
      title: 'Nuovo',
      collectionId: 'news',
      publishedAt: new Date('2026-03-01T10:00:00Z'),
    });
    // Another section entirely: it must not become anybody's neighbour.
    await seedPage(deps, {
      slug: 'altrove',
      title: 'Altrove',
      collectionId: 'events',
      publishedAt: new Date('2026-02-15T10:00:00Z'),
    });

    const current = await currentArticleOf(deps, tenantId, {
      pageGroupId: middle.group.id,
      publishedAt: middle.translation.publishedAt,
    });
    const [content] = await resolveArticleBlocks(
      deps,
      tenantId,
      siteId,
      locale,
      current!,
      [articleContent],
    );

    const nav = propsOf(content, 'nav');
    expect((nav['previous'] as { title: string } | null)?.title).toBe(
      'Vecchio',
    );
    expect((nav['next'] as { title: string } | null)?.title).toBe('Nuovo');
    expect(older.group.id).not.toBe(newer.group.id);
  });

  /*
   * A page in no section has no archive to travel through: its neighbours
   * in the page tree are a menu, not a reading order.
   */
  it('gives a page outside every section no neighbours at all', async () => {
    const deps = setup();
    await seedPage(deps, {
      slug: 'altra',
      title: 'Altra',
      publishedAt: new Date('2026-01-01T10:00:00Z'),
    });
    const lone = await seedPage(deps, {
      slug: 'sola',
      title: 'Sola',
      publishedAt: new Date('2026-02-01T10:00:00Z'),
    });

    const current = await currentArticleOf(deps, tenantId, {
      pageGroupId: lone.group.id,
      publishedAt: lone.translation.publishedAt,
    });
    const [content] = await resolveArticleBlocks(
      deps,
      tenantId,
      siteId,
      locale,
      current!,
      [articleContent],
    );

    expect(propsOf(content, 'nav')['previous']).toBeNull();
    expect(propsOf(content, 'nav')['next']).toBeNull();
  });

  it('lists the pages that share a term, newest first, itself excluded', async () => {
    const deps = setup();
    const term = Term.create({ id: 'term-1', tenantId, taxonomyId: 'tax-1' });
    await deps.taxonomyRepository.saveTerm(term);
    const self = await seedPage(deps, {
      slug: 'io',
      title: 'Io',
      publishedAt: new Date('2026-02-01T10:00:00Z'),
    });
    const older = await seedPage(deps, {
      slug: 'vecchia',
      title: 'Vecchia',
      publishedAt: new Date('2026-01-01T10:00:00Z'),
    });
    const newer = await seedPage(deps, {
      slug: 'nuova',
      title: 'Nuova',
      publishedAt: new Date('2026-03-01T10:00:00Z'),
    });
    const third = await seedPage(deps, {
      slug: 'terza',
      title: 'Terza',
      publishedAt: new Date('2026-04-01T10:00:00Z'),
    });
    for (const page of [self, older, newer, third]) {
      await deps.taxonomyRepository.setTermsForPageGroup(
        tenantId,
        page.group.id,
        ['term-1'],
      );
    }

    const current = await currentArticleOf(deps, tenantId, {
      pageGroupId: self.group.id,
      publishedAt: self.translation.publishedAt,
    });
    const [content] = await resolveArticleBlocks(
      deps,
      tenantId,
      siteId,
      locale,
      current!,
      [articleContent],
    );

    const items = propsOf(content, 'related')['items'] as { title: string }[];
    // Capped at the block's own limit of two, newest first, and never the
    // page it is sitting on.
    expect(items.map((item) => item.title)).toEqual(['Terza', 'Nuova']);
  });
});
