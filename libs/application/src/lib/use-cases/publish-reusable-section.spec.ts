import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  PageGroup,
  PageTranslation,
  ReusableSection,
} from '@brisk/domain-core';
import { sectionOverrideKey, type PageContent } from '@brisk/shared-types';
import {
  InMemoryPageGroupRepository,
  InMemoryPageGroupVersionRepository,
  InMemoryPageTranslationRepository,
  InMemoryPageTranslationVersionRepository,
  InMemoryReusableSectionRepository,
  InMemoryReusableSectionVersionRepository,
  InMemorySearchPort,
} from './in-memory-repositories.test-fixture';
import { publishReusableSection } from './publish-reusable-section.use-case';
import { publishPageTranslation } from './publish-page-translation.use-case';

const tenantId = 'tenant-1';
const siteId = 'site-1';

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
    reusableSectionRepository: new InMemoryReusableSectionRepository(),
    reusableSectionVersionRepository:
      new InMemoryReusableSectionVersionRepository(),
    searchPort: new InMemorySearchPort(),
  };
}

async function seedSection(
  deps: ReturnType<typeof setup>,
  content: PageContent,
) {
  const section = ReusableSection.create({
    id: randomUUID(),
    tenantId,
    siteId,
    name: 'Our services',
    kind: 'shared',
    content,
  });
  section.publish();
  await deps.reusableSectionRepository.save(section);
  return section;
}

/** A published page carrying one instance of `sectionId`. */
async function seedPageUsing(
  deps: ReturnType<typeof setup>,
  sectionId: string,
  overrides: Record<string, string> = {},
) {
  const group = PageGroup.create({
    id: randomUUID(),
    tenantId,
    siteId,
    createdBy: null,
  });
  group.saveContent([
    {
      id: 'inst-1',
      type: 'Section',
      props: {
        section: { sectionId, sectionName: 'Our services' },
        ...overrides,
      },
    },
  ]);
  await deps.pageGroupRepository.save(group);

  const translation = PageTranslation.create({
    id: randomUUID(),
    tenantId,
    siteId,
    pageGroupId: group.id,
    locale: 'it',
    slug: `page-${randomUUID()}`,
    seoMeta: { title: 'Page', description: '' },
    createdBy: null,
  });
  await deps.pageTranslationRepository.save(translation, null);
  await publishPageTranslation(deps, {
    tenantId,
    pageTranslationId: translation.id,
  });
  return translation;
}

describe('a section’s words reach the search index', () => {
  /*
   * The half of the feature that is easy to forget: search indexes a page
   * from its published snapshot, and that snapshot holds a REFERENCE where
   * the section's words are. Without resolution the page would be
   * unsearchable for every word the section contributes.
   */
  it('indexes a page by the section it shows, not by the reference', async () => {
    const deps = setup();
    const section = await seedSection(deps, [
      { id: 'b1', type: 'Heading', props: { text: 'Plumbing and heating' } },
    ]);
    await seedPageUsing(deps, section.id);

    const indexed = deps.searchPort.indexed.at(-1);
    expect(JSON.stringify(indexed?.content)).toContain('Plumbing and heating');
    // The snapshot itself still stores only the reference — that is what
    // lets publishing the section alone update every page using it.
    const stored = await deps.pageTranslationRepository.findById(
      tenantId,
      indexed?.translation.id ?? '',
    );
    expect(JSON.stringify(stored?.publishedSnapshot)).not.toContain(
      'Plumbing and heating',
    );
  });

  it('re-indexes every page using a section when the section is published', async () => {
    const deps = setup();
    const section = await seedSection(deps, [
      { id: 'b1', type: 'Heading', props: { text: 'Old words' } },
    ]);
    await seedPageUsing(deps, section.id);
    await seedPageUsing(deps, section.id);
    const before = deps.searchPort.indexed.length;

    section.saveDraft([
      { id: 'b1', type: 'Heading', props: { text: 'New words' } },
    ]);
    await deps.reusableSectionRepository.save(section);
    await publishReusableSection(deps, { tenantId, id: section.id });

    const after = deps.searchPort.indexed.slice(before);
    expect(after).toHaveLength(2);
    for (const entry of after) {
      expect(JSON.stringify(entry.content)).toContain('New words');
    }
  });

  it('leaves pages that do not use the section alone', async () => {
    const deps = setup();
    const used = await seedSection(deps, [
      { id: 'b1', type: 'Heading', props: { text: 'Used' } },
    ]);
    const unused = await seedSection(deps, [
      { id: 'b2', type: 'Heading', props: { text: 'Unused' } },
    ]);
    await seedPageUsing(deps, used.id);
    const before = deps.searchPort.indexed.length;

    await publishReusableSection(deps, { tenantId, id: unused.id });

    expect(deps.searchPort.indexed).toHaveLength(before);
  });

  it('indexes the instance’s own overridden value, not the section’s', async () => {
    const deps = setup();
    const section = await seedSection(deps, [
      { id: 'b1', type: 'Heading', props: { text: 'Our services' } },
    ]);
    await seedPageUsing(deps, section.id, {
      [sectionOverrideKey('b1', 'text')]: 'What we do',
    });

    const indexed = deps.searchPort.indexed.at(-1);
    expect(JSON.stringify(indexed?.content)).toContain('What we do');
  });
});
